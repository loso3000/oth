// SPDX-License-Identifier: Apache-2.0
/*

 * Copyright (C) 2022-2026 sirpdboy <herboy2008@gmail.com>
 */
'use strict';
'require dom';
'require fs';
'require poll';
'require uci';
'require view';
'require form';

return view.extend({
	render: function () {
		var css = `
			/* 日志框文本区域 */
			#log_textarea pre {
				padding: 10px; /* 内边距 */
				border-bottom: 1px solid #ddd; /* 边框颜色 */
				font-size: small;
				line-height: 1.3; /* 行高 */
				white-space: pre-wrap;
				word-wrap: break-word;
				overflow-y: auto;
			}
			/* 5s 自动刷新文字 */
			.cbi-section small {
				margin-left: 1rem;
				font-size: small; 
				color: #666; /* 深灰色文字 */
			}
			/* 倒序显示相关样式 */
			.log-container {
				display: flex;
				flex-direction: column-reverse;
				max-height: 800px;
				overflow-y: auto;
				border-radius: 3px;
				margin-top: 10px;
				padding: 5px;
			}
			.log-line {
				padding: 3px 0;
				font-family: monospace;
				font-size: 12px;
				line-height: 1.4;
			}
			.log-line:last-child {
				border-bottom: none;
			}
			.log-timestamp {
				font-weight: bold;
				margin-right: 10px;
			}
		`;

		var log_container = E('div', { 'class': 'log-container', 'id': 'log_container' },
			E('img', {
				'src': L.resource(['icons/loading.gif']),
				'alt': _('Loading...'),
				'style': 'vertical-align:middle'
			}, _('Collecting data ...'))
		);

		var log_path = '/var/log/timecontrol.log';
		var lastLogContent = '';

		// 解析日志行的时间戳，用于排序
		function parseLogTimestamp(logLine) {
			// 假设日志格式为: [2024-01-01 12:00:00] INFO: some message
			var timestampMatch = logLine.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
			if (timestampMatch) {
				return new Date(timestampMatch[1]).getTime();
			}
			// 如果没有时间戳，使用当前时间
			return Date.now();
		}

		// 倒序排列日志行（最新的在上面）
		function reverseLogLines(logContent) {
			if (!logContent || logContent.trim() === '') {
				return logContent;
			}
			
			// 按行分割
			var lines = logContent.split('\n');
			
			// 过滤空行
			lines = lines.filter(function(line) {
				return line.trim() !== '';
			});
			
			// 按时间戳排序（最新的在前面）
			lines.sort(function(a, b) {
				var timeA = parseLogTimestamp(a);
				var timeB = parseLogTimestamp(b);
				return timeB - timeA; // 降序排列
			});
			
			// 重新组合为字符串
			return lines.join('\n');
		}

		// 将日志内容转换为HTML行
		function formatLogLines(logContent) {
			if (!logContent || logContent.trim() === '') {
				return E('div', { 'class': 'log-line' }, _('Log is clean.'));
			}
			
			var lines = logContent.split('\n');
			var formattedLines = [];
			
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i].trim();
				if (line === '') continue;
				
				// 提取时间戳
				var timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
				var timestampSpan = null;
				var messageSpan = null;
				
				if (timestampMatch) {
					timestampSpan = E('span', { 
						'class': 'log-timestamp',
						'title': timestampMatch[1]
					}, timestampMatch[0]);
					messageSpan = E('span', {}, line.substring(timestampMatch[0].length));
				} else {
					messageSpan = E('span', {}, line);
				}
				
				var lineDiv = E('div', { 'class': 'log-line' }, [
					timestampSpan,
					messageSpan
				].filter(function(el) { return el !== null; }));
				
				formattedLines.push(lineDiv);
			}
			
			return E('div', {}, formattedLines);
		}

		var clear_log_button = E('div', {}, [
			E('button', {
				'class': 'cbi-button cbi-button-remove',
				'click': function (ev) {
					ev.preventDefault();
					var button = ev.target;
					button.disabled = true;
					button.textContent = _('Clear Logs...');
					fs.exec_direct('/usr/libexec/timecontrol-call', ['clear_log'])
						.then(function () {
							button.textContent = _('Logs cleared successfully!');
							button.disabled = false;
							button.textContent = _('Clear Logs');
							// 立即刷新日志显示框
							var logContent = _('Log is clean.');
							lastLogContent = logContent;
							dom.content(log_container, formatLogLines(logContent));
						})
						.catch(function () {
							button.textContent = _('Failed to clear log.');
							button.disabled = false;
							button.textContent = _('Clear Logs');
						});
				}
			}, _('Clear Logs'))
		]);

		poll.add(L.bind(function () {
			return fs.read_direct(log_path, 'text')
				.then(function (res) {
					var logContent = res.trim();
					if (logContent === '') {
						logContent = _('Log is clean.');
					}
					
					// 检查内容是否有变化
					if (logContent !== lastLogContent) {
						// 倒序排列日志
						var reversedLog = reverseLogLines(logContent);
						// 格式化为HTML
						var formattedLog = formatLogLines(reversedLog);
						dom.content(log_container, formattedLog);
						lastLogContent = logContent;
						
						// 滚动到顶部（因为最新的在上面）
						log_container.scrollTop = 0;
					}
				}).catch(function (err) {
					var logContent;
					if (err.toString().includes('NotFoundError')) {
						logContent = _('Log file does not exist.');
					} else {
						logContent = _('Unknown error: %s').format(err);
					}
					
					if (logContent !== lastLogContent) {
						dom.content(log_container, formatLogLines(logContent));
						lastLogContent = logContent;
					}
				});
		}));

		// 启动轮询
		poll.start();
		return E('div', { 'class': 'cbi-map' }, [
			E('style', [css]),
			E('div', { 'class': 'cbi-section' }, [
				clear_log_button,
				log_container,
				E('small', {}, _('Refresh every 5 seconds.').format(L.env.pollinterval)),
				E('div', { 'class': 'cbi-section-actions cbi-section-actions-right' })
			]),
		E('div', { 'style': 'text-align: right;  font-style: italic;' }, [
                E('span', {}, [
                    _('© github '),
                    E('a', { 
                        'href': 'https://github.com/sirpdboy/luci-app-timecontrol', 
                        'target': '_blank',
                        'style': 'text-decoration: none;'
                    }, 'by sirpdboy')
                ])
            ])


		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

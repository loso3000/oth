// Copyright (C) 2019-2026 sirpdboy
// Fixed version with correct poll.add() syntax

'use strict';
'require view';
'require poll';
'require dom';
'require fs';
'require uci';
'require ui';
'require form';

var ResultFile = '/tmp/netspeedtest_result';
var ProgressFile = '/tmp/netspeedtest_progress';
var SpeedtestScript = '/usr/bin/netspeedtest.sh';
var LOG_FILE = '/tmp/netspeedtest.log';
var PidFile = '/var/run/netspeedtest.pid';

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(fs.stat('/usr/bin/ookla-speedtest'), {}),
            L.resolveDefault(fs.stat('/usr/bin/speedtest'), {}),
            L.resolveDefault(fs.read(ResultFile), null),
            L.resolveDefault(fs.stat(ResultFile), {}),
            L.resolveDefault(fs.read(ProgressFile), null),
            L.resolveDefault(fs.stat(ProgressFile), {}),
            L.resolveDefault(fs.stat(PidFile), {}),
            uci.load('netspeedtest')
        ]);
    },

    // 检测可用版本
    detectVersions: function(res) {
        var hasOokla = !!(res[0] && res[0].path);
        var hasPython = !!(res[1] && res[1].path);
        
        return {
            ookla: hasOokla,
            python: hasPython,
            available: hasOokla || hasPython
        };
    },

    // 检查测试是否正在运行
    isTestRunning: function(res) {
        // 检查PID文件
        var pidStat = res[6];
        if (pidStat && pidStat.mtime) {
            var pidAge = Date.now() - (pidStat.mtime * 1000);
            if (pidAge < 300000) { // 5分钟内
                return true;
            }
        }
        
        // 检查结果文件状态
        var resultContent = (res[2] && res[2].trim) ? res[2].trim().split("\n") : [];
        var resultMtime = (res[3] && res[3].mtime) ? res[3].mtime * 1000 : 0;
        
        if (resultContent.length > 0 && resultContent[0] === 'Testing') {
            if ((Date.now() - resultMtime) < 300000) { // 5分钟内
                return true;
            }
        }
        
        return false;
    },

    // 解析结果
    parseResult: function(content) {
        if (!content || content.length === 0) {
            return { status: 'none', data: null };
        }
        
        var firstLine = content[0];
        
        if (firstLine === 'Testing') {
            return { status: 'testing', data: null };
        }
        
        if (firstLine === 'Test failed') {
            return { status: 'failed', data: null };
        }
        
        // 检查是否是URL
        if (firstLine.match(/^https?:\/\//)) {
            return { status: 'url', data: firstLine };
        }
        
        // 检查是否是图片URL
        if (firstLine.match(/\.png$/)) {
            return { status: 'url', data: firstLine };
        }
        
        if (firstLine.match(/Download:/i) || firstLine.match(/Upload:/i)) {
            return { status: 'speed', data: content.join('\n') };
        }
        
        return { status: 'unknown', data: firstLine };
    },

    // 解析进度信息
    parseProgress: function(content) {
        if (!content || content.length === 0) {
            return null;
        }
        
        // 尝试解析JSON
        try {
            // 去除可能的空白字符
            var trimmed = content.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                return JSON.parse(trimmed);
            }
        } catch(e) {
            console.error('Failed to parse progress JSON:', e, 'Content:', content);
        }
        
        // 如果不是JSON，返回简单对象
        return {
            stage: 'unknown',
            message: content.substring(0, 100)
        };
    },

    render: function(res) {
        var self = this;
        var hasOokla = !!(res[0] && res[0].path);
        var hasPython = !!(res[1] && res[1].path);
        var resultContent = (res[2] && res[2].trim) ? res[2].trim().split("\n") : [];
        var resultMtime = (res[3] && res[3].mtime) ? res[3].mtime * 1000 : 0;
        var progressContent = (res[4] && res[4].trim) ? res[4].trim() : null;
        
        var versions = this.detectVersions(res);
        var isTestingNow = this.isTestRunning(res);
        
        console.log('Initial render - isTestingNow:', isTestingNow);
        console.log('Result content:', resultContent);
        console.log('Progress content:', progressContent);
        
        var progress = this.parseProgress(progressContent);
        
        var m, s, o;
        m = new form.Map('netspeedtest', _('WAN SpeedTest'));
        
        // 配置部分
        s = m.section(form.NamedSection, 'config', 'netspeedtest');
        s.anonymous = true;
        
        // 版本选择
        o = s.option(form.ListValue, 'test_version', _('Select Test Version'));
        
        if (hasOokla) {
            o.value('ookla', 'Ookla SpeedTest');
        }
        if (hasPython) {
            o.value('python', 'Python speedtest-cli');
        }
        
        if (hasOokla) {
            o.default = 'ookla';
        } else if (hasPython) {
            o.default = 'python';
        }
        
        // 版本变更时保存到uci
        o.write = function(section_id, formvalue) {
            uci.set('netspeedtest', section_id, 'test_version', formvalue);
            return uci.save('netspeedtest');
        };
        
        // 开始测试按钮
        o = s.option(form.Button, 'start', _('Start Speed Test'));
        o.inputtitle = _('Click to start speed test');
        o.inputstyle = 'apply';
        
        if (isTestingNow || !versions.available) {
            o.readonly = true;
        }
        
        o.onclick = function(ev, section_id) {
            // 获取选中的版本
            var versionSelect = document.getElementById('widget.cbid.netspeedtest.config.test_version');
            if (!versionSelect) {
                versionSelect = document.querySelector('select[name="test_version"]');
            }
            var version = versionSelect ? versionSelect.value : (hasOokla ? 'ookla' : 'python');
            
            // 立即显示测试中的状态
            var resultDiv = document.getElementById('netspeedtest_re');
            if (resultDiv) {
                resultDiv.innerHTML = self.renderTestingUI(null);
            }
            
            // 禁用按钮
            var startBtn = document.querySelector('.cbi-button-apply');
            if (startBtn) {
                startBtn.disabled = true;
            }
            
            // 使用ubus执行命令，避免XHR超时
            // 这是更可靠的方式
            return ubus.call('luci', 'exec', {
                command: '/bin/sh',
                params: ['-c', SpeedtestScript + ' --version ' + version + ' > /dev/null 2>&1 &']
            }).then(function(result) {
                console.log('Test started via ubus:', result);
                
                // 显示启动成功消息
                ui.addNotification(null, E('p', _('Speed test started. Please wait...')), 'info');
                
                // 立即启动轮询
                self.startPolling();
            }).catch(function(e) {
                console.error('Failed to start test via ubus:', e);
                
                // 尝试直接执行命令作为后备方案
                return fs.exec('/bin/sh', ['-c', 'nohup ' + SpeedtestScript + ' --version ' + version + ' > /dev/null 2>&1 &'])
                    .then(function(result) {
                        console.log('Test started via fs.exec:', result);
                        ui.addNotification(null, E('p', _('Speed test started. Please wait...')), 'info');
                        self.startPolling();
                    })
                    .catch(function(e2) {
                        console.error('Failed to start test via fs.exec:', e2);
                        ui.addNotification(null, E('p', _('Failed to start test. Please check logs.')), 'error');
                        
                        // 启用按钮
                        if (startBtn) {
                            startBtn.disabled = false;
                        }
                    });
            });
            
            return false; // 阻止默认事件
        };
        
        // 结果显示区域
        s = m.section(form.TypedSection, '_result');
        s.anonymous = true;
        s.render = function() {
            return self.renderResult(resultContent, progress, isTestingNow);
        };
        
        // 查看日志按钮
        o = s.option(form.Button, 'view_log', _('View Test Log'));
        o.inputtitle = _('Click to view detailed test log');
        o.inputstyle = 'cbi-button cbi-button-info';
        o.onclick = this.showLog.bind(this);
        
        // 刷新按钮
        o = s.option(form.Button, 'refresh', _('Refresh Results'));
        o.inputtitle = _('Refresh display');
        o.inputstyle = 'cbi-button cbi-button-reload';
        o.onclick = function() {
            window.location.reload();
        };
        
        // 页面加载完成后显示结果（如果有）
        setTimeout(function() {
            var resultDiv = document.getElementById('netspeedtest_re');
            if (resultDiv && resultContent.length > 0 && resultContent[0] !== 'Testing') {
                console.log('Initial display of results');
                resultDiv.innerHTML = '';
                var newResult = self.renderResult(resultContent, progress, false);
                dom.content(resultDiv, newResult);
            }
            
            // 启动轮询检查状态
            self.startPolling();
        }, 500);
        
        return m.render();
    },
    
    // 渲染测试中的UI
    renderTestingUI: function(progress) {
        var html = '<div style="padding:20px; background:#e3f2fd; border-radius:8px;">';
        html += '<div style="display:flex; align-items:center; margin-bottom:15px;">';
        html += '<img src="/luci-static/resources/icons/loading.svg" height="32" style="vertical-align:middle; margin-right:10px;"/>';
        html += '<span style="color:#0d47a1; font-weight:bold; font-size:16px;">' + _('Speed testing in progress...') + '</span>';
        html += '</div>';
        
        if (progress) {
            html += '<div style="margin-top:10px; padding:10px; background:white; border-radius:4px;">';
            if (progress.stage) {
                var stageText = '';
                switch(progress.stage) {
                    case 'start': stageText = '启动中'; break;
                    case 'detect': stageText = '检测版本'; break;
                    case 'selected': stageText = '选择版本'; break;
                    case 'preparing': stageText = '准备测试'; break;
                    case 'testing': stageText = '测速中'; break;
                    case 'complete': stageText = '完成'; break;
                    case 'failed': stageText = '失败'; break;
                    case 'error': stageText = '错误'; break;
                    default: stageText = progress.stage;
                }
                html += '<div style="margin-bottom:5px;"><strong>' + _('Stage:') + '</strong> ' + stageText + '</div>';
            }
            if (progress.message) {
                html += '<div style="color:#666;">' + progress.message + '</div>';
            }
            html += '</div>';
        } else {
            html += '<div style="margin-top:10px; padding:10px; background:white; border-radius:4px; color:#666;">';
            html += _('Initializing test...');
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    },
    
    // 渲染结果
    renderResult: function(resultContent, progress, isTestingNow) {
        var result = this.parseResult(resultContent);
        
        var resultDiv = E('div', { 
            id: 'netspeedtest_re',
            class: 'cbi-section',
            style: 'padding:20px; background:#f9f9f9; border-radius:4px; margin-top:10px; min-height:100px;'
        });
        
        if (isTestingNow) {
            dom.content(resultDiv, E('div', { 
                style: 'padding:20px; background:#e3f2fd; border-radius:8px;' 
            }, this.renderTestingUI(progress)));
            
        } else if (result.status === 'url') {
            console.log('Rendering URL result:', result.data);
            var imageUrl = result.data;
            // 确保图片URL正确
            if (!imageUrl.match(/\.png$/)) {
                imageUrl = imageUrl + '.png';
            }
            // 如果是speedtest.net的URL，使用正确的图片URL格式
            if (imageUrl.includes('speedtest.net/result/c/')) {
                imageUrl = imageUrl.replace('/result/c/', '/result/') + '.png';
            }
            
            dom.content(resultDiv, [
                E('div', { style: 'text-align:center;' }, [
                    E('a', { href: result.data, target: '_blank' }, [
                        E('img', { 
                            src: imageUrl,
                            style: 'max-width:100%; max-height:400px; border-radius:8px; box-shadow:0 4px 8px rgba(0,0,0,0.1);',
                            onerror: 'this.onerror=null; this.src="/luci-static/resources/icons/error.png"; this.alt="Failed to load image";'
                        })
                    ]),
                    E('br'),
                    E('a', { 
                        href: result.data, 
                        target: '_blank',
                        style: 'display:inline-block; margin-top:10px; color:#0066cc;'
                    }, _('View detailed results'))
                ])
            ]);
            
        } else if (result.status === 'speed') {
            var lines = result.data.split('\n');
            var download = '';
            var upload = '';
            var latency = '';
            var other = [];
            
            lines.forEach(function(line) {
                if (line.match(/Download:/i)) download = line;
                else if (line.match(/Upload:/i)) upload = line;
                else if (line.match(/Latency:/i)) latency = line;
                else if (line.trim() !== '') other.push(line);
            });
            
            var content = [
                E('div', { style: 'padding:20px; background:white; border-radius:8px;' }, [
                    E('h3', { style: 'margin-top:0; color:#333;' }, _('Test Results:'))
                ])
            ];
            
            if (download) {
                content.push(E('div', { style: 'font-size:18px; margin:10px 0; padding:10px; background:#e8f5e8; border-radius:4px;' }, [
                    E('span', { style: 'font-weight:bold;' }, '⬇️ ' + _('Download:') + ' '),
                    E('span', { style: 'color:#2e7d32;' }, download.replace(/Download:/i, '').trim())
                ]));
            }
            
            if (upload) {
                content.push(E('div', { style: 'font-size:18px; margin:10px 0; padding:10px; background:#e3f2fd; border-radius:4px;' }, [
                    E('span', { style: 'font-weight:bold;' }, '⬆️ ' + _('Upload:') + ' '),
                    E('span', { style: 'color:#1565c0;' }, upload.replace(/Upload:/i, '').trim())
                ]));
            }
            
            if (latency) {
                content.push(E('div', { style: 'font-size:16px; margin:10px 0; color:#666;' }, [
                    E('span', { style: 'font-weight:bold;' }, '⏱️ ' + _('Latency:') + ' '),
                    E('span', {}, latency.replace(/Latency:/i, '').trim())
                ]));
            }
            
            if (other.length > 0) {
                content.push(E('div', { style: 'margin-top:15px; padding:10px; background:#f5f5f5; border-radius:4px;' }, [
                    E('pre', { style: 'margin:0; font-family:inherit; white-space:pre-wrap;' }, other.join('\n'))
                ]));
            }
            
            dom.content(resultDiv, content);
            
        } else if (result.status === 'failed') {
            dom.content(resultDiv, [
                E('div', { style: 'padding:20px; background:#ffebee; border-radius:8px; color:#c62828; text-align:center;' }, [
                    E('div', { style: 'font-size:48px; margin-bottom:10px;' }, '❌'),
                    E('div', { style: 'font-size:18px; font-weight:bold; margin-bottom:10px;' }, _('Test Failed')),
                    E('div', {}, _('Please check system log for details.'))
                ])
            ]);
            
        } else {
            dom.content(resultDiv, [
                E('div', { style: 'text-align:center; padding:30px; color:#666;' }, [
                    E('span', { style: 'font-size:48px;' }, '������'),
                    E('br'),
                    E('em', {}, _('No test results yet. Click "Start Speed Test" to begin.'))
                ])
            ]);
        }
        
        return resultDiv;
    },
    
    // 启动轮询 - 修复poll.add()的调用方式
    startPolling: function() {
        var self = this;
        
        // 清除现有轮询
        if (this.pollInterval) {
            poll.remove(this.pollInterval);
            this.pollInterval = null;
        }
        
        console.log('Starting poll interval');
        
        // 正确的poll.add()调用方式：第一个参数是回调函数，第二个参数是间隔时间（毫秒）
        this.pollInterval = poll.add(function() {
            // 这个函数会定期执行
            Promise.all([
                L.resolveDefault(fs.read(ResultFile), null),
                L.resolveDefault(fs.stat(ResultFile), {}),
                L.resolveDefault(fs.read(ProgressFile), null),
                L.resolveDefault(fs.stat(ProgressFile), {}),
                L.resolveDefault(fs.stat(PidFile), {})
            ]).then(function(results) {
                var resultContent = (results[0] && results[0].trim) ? results[0].trim().split("\n") : [];
                var resultStat = results[1] || {};
                var progressContent = (results[2] && results[2].trim) ? results[2].trim() : null;
                var progressStat = results[3] || {};
                var pidStat = results[4] || {};
                
                // 判断是否在运行
                var isRunning = false;
                var now = Date.now();
                
                // 检查PID文件
                if (pidStat && pidStat.mtime) {
                    var pidAge = now - (pidStat.mtime * 1000);
                    if (pidAge < 300000) { // 5分钟内
                        isRunning = true;
                    }
                }
                
                // 检查结果文件
                if (!isRunning && resultContent.length > 0 && resultContent[0] === 'Testing') {
                    if (resultStat.mtime) {
                        var resultAge = now - (resultStat.mtime * 1000);
                        if (resultAge < 300000) { // 5分钟内
                            isRunning = true;
                        }
                    }
                }
                
                // 检查进度文件
                if (!isRunning && progressContent) {
                    if (progressStat && progressStat.mtime) {
                        var progressAge = now - (progressStat.mtime * 1000);
                        if (progressAge < 300000) { // 5分钟内
                            isRunning = true;
                        }
                    }
                }
                
                console.log('Poll result - isRunning:', isRunning, 'result:', resultContent[0]);
                
                var progress = null;
                if (progressContent) {
                    progress = self.parseProgress(progressContent);
                }
                
                var resultDiv = document.getElementById('netspeedtest_re');
                var startBtn = document.querySelector('.cbi-button-apply');
                
                if (resultDiv) {
                    if (isRunning) {
                        // 测试中，显示进度
                        resultDiv.innerHTML = self.renderTestingUI(progress);
                    } else {
                        // 测试完成或没有测试，渲染结果
                        if (resultContent.length > 0 && resultContent[0] !== 'Testing') {
                            resultDiv.innerHTML = '';
                            var newResult = self.renderResult(resultContent, progress, false);
                            dom.content(resultDiv, newResult);
                        }
                    }
                }
                
                if (startBtn) {
                    startBtn.disabled = isRunning;
                }
            });
        }, 2000); // 2秒间隔
    },
    
    showLog: function() {
        return fs.read_direct(LOG_FILE)
            .then(function(content) {
                var logContent = content || 'Log file is empty';
                ui.showModal(_('Speed Test Log'), [
                    E('pre', { 
                        style: 'max-height:400px; overflow:auto; padding:15px; border-radius:4px; font-family:monospace; font-size:12px; white-space:pre-wrap; background:#f5f5f5;'
                    }, [ escapeHTML(logContent) ])
                ], [
                    E('button', {
                        class: 'btn btn-primary',
                        onclick: function() {
                            ui.hideModal();
                        }
                    }, _('Close'))
                ]);
            })
            .catch(function(e) {
                ui.addNotification(null, E('p', _('Failed to read log: ') + e.message), 'error');
            });
    },
    
    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
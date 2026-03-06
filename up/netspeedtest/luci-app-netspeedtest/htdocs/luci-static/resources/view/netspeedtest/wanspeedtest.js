// Copyright (C) 2019-2026 sirpdboy
// Fixed version with real-time status update

'use strict';
'require view';
'require poll';
'require dom';
'require fs';
'require uci';
'require ui';
'require form';

var ResultFile = '/tmp/netspeedtest_result';
var SpeedtestScript = '/usr/bin/netspeedtest.sh';
var LOG_FILE = '/tmp/netspeedtest.log';

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(fs.stat('/usr/bin/ookla-speedtest'), {}),
            L.resolveDefault(fs.stat('/usr/bin/speedtest'), {}),
            L.resolveDefault(fs.read(ResultFile), null),
            L.resolveDefault(fs.stat(ResultFile), {}),
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
        
        if (firstLine.match(/^https?:\/\//) || firstLine.match(/\.png$/)) {
            return { status: 'url', data: firstLine };
        }
        
        if (firstLine.match(/Download:/i)) {
            return { status: 'speed', data: firstLine };
        }
        
        return { status: 'unknown', data: firstLine };
    },

    // 检查是否正在测试
    isTesting: function(resultContent, resultMtime) {
        return !!(resultContent && 
               resultContent.length > 0 && 
               resultContent[0] === 'Testing' && 
               (Date.now() - resultMtime) < 120000);
    },

    render: function(res) {
        var self = this;
        var hasOokla = !!(res[0] && res[0].path);
        var hasPython = !!(res[1] && res[1].path);
        var resultContent = (res[2] && res[2].trim) ? res[2].trim().split("\n") : [];
        var resultMtime = (res[3] && res[3].mtime) ? res[3].mtime * 1000 : 0;
        
        var versions = this.detectVersions(res);
        var isTestingNow = this.isTesting(resultContent, resultMtime);
        
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
        o.inputtitle = _('Click to execute');
        o.inputstyle = 'apply';
        
        if (isTestingNow || !versions.available) {
            o.readonly = true;
        }
        
        o.onclick = function(ev, section_id) {
            // console.log('Start button clicked');
            
            // 检查脚本是否存在
            return fs.stat(SpeedtestScript)
                .then(function(stat) {
                    if (!stat || !stat.path) {
                        throw new Error('Speed test script not found');
                    }
                    
                    var versionSelect = document.getElementById('widget.cbid.netspeedtest.config.test_version');
                    
                    if (!versionSelect) {
                        versionSelect = document.querySelector('select[name="test_version"]');
                    }
                    if (!versionSelect) {
                        throw new Error('Version selection not found');
                    }
                    
                    var version = versionSelect.value;
                    
                    if (!version || version === '') {
                        version = hasOokla ? 'ookla' : 'python';
                    }
                    
                    // 构建命令
                    var cmd = SpeedtestScript;
                    if (version) {
                        cmd += ' --version ' + version;
                    }
                    
                    //console.log('Command:', cmd);
                    
                    // 立即显示测试中的状态
                    var resultDiv = document.getElementById('netspeedtest_re');
                    if (resultDiv) {
                        resultDiv.innerHTML = "<div style='padding:20px;'>" +
                            "<img src='/luci-static/resources/icons/loading.svg' height='32' style='vertical-align:middle; margin-right:10px;'/> " +
                            "<span style='color:green;font-weight:bold; font-size:16px;'>" + _('Speed testing in progress...') + "</span>" +
                            "</div>";
                    }
                    
                    // 禁用按钮
                    var startBtn = document.querySelector('.cbi-button-apply');
                    if (startBtn) {
                        startBtn.disabled = true;
                    }
                    
                    ui.addNotification(null, E('p', _('Starting speed test...')), 'info');
                    
                    return fs.exec('/bin/sh', ['-c', cmd])
                        .then(function(result) {
                            console.log('Test started result:', result);
                            if (result.code === 0) {
                                ui.addNotification(null, E('p', _('Speed test started. Please wait...')), 'info');
                                // 轮询会更新结果，不需要额外操作
                            } else {
                                // 如果执行失败，立即显示错误
                                var errorMsg = result.stderr || 'Unknown error';
                                console.error('Test failed:', errorMsg);
                                
                                // 写入失败状态到结果文件
                                return fs.write(ResultFile, 'Test failed\n')
                                    .then(function() {
                                        // 更新显示
                                        if (resultDiv) {
                                            resultDiv.innerHTML = "<div style='padding:20px; background:#ffebee; border-radius:8px; color:#c62828;'>" +
                                                "<div style='font-size:18px; font-weight:bold; margin-bottom:10px;'>❌ " + _('Test Failed') + "</div>" +
                                                "<div>" + _('Please check system log for details.') + "</div>" +
                                                "</div>";
                                        }
                                        // 启用按钮
                                        if (startBtn) {
                                            startBtn.disabled = false;
                                        }
                                        throw new Error('Test failed. Check log for details.');
                                    });
                            }
                        })
                        .catch(function(e) {
                            console.error('Test start failed:', e);
                            ui.addNotification(null, E('p', _('Failed to start test: ') + e.message), 'error');
                            
                            // 启用按钮
                            if (startBtn) {
                                startBtn.disabled = false;
                            }
                        });
                })
                .catch(function(e) {
                    console.error('Test start failed:', e);
                    ui.addNotification(null, E('p', _('Failed to start test: ') + e.message), 'error');
                });
        };
        
        // 结果显示区域
        s = m.section(form.TypedSection, '_result');
        s.anonymous = true;
        s.render = function() {
            var result = self.parseResult(resultContent);
            
            var resultDiv = E('div', { 
                id: 'netspeedtest_re',
                class: 'cbi-section',
                style: 'padding:20px; background:#f9f9f9; border-radius:4px; margin-top:10px; min-height:100px;'
            });
            
            if (result.status === 'testing') {
                dom.content(resultDiv, [
                    E('div', { style: ' padding:20px;' }, [
                        E('img', { 
                            src: L.resource('icons/loading.svg'), 
                            height: '32', 
                            style: 'vertical-align:middle; margin-right:10px;' 
                        }),
                        E('span', { style: 'color:green;font-weight:bold; font-size:16px;' }, 
                            _('Speed testing in progress...'))
                    ])
                ]);
            } else if (result.status === 'url') {
                var imageUrl = result.data;
                if (!imageUrl.match(/\.png$/)) {
                    imageUrl = imageUrl + '.png';
                }
                dom.content(resultDiv, [
                    E('div',  [
                        E('a', { href: result.data, target: '_blank' }, [
                            E('img', { 
                                src: imageUrl,
                                style: 'max-width:100%; max-height:400px; border-radius:8px; box-shadow:0 4px 8px rgba(0,0,0,0.1);',
                                onerror: 'this.onerror=null; this.src="/luci-static/resources/icons/error.png";'
                            })
                        ]),
                        E('br'),
                        E('a', { 
                            href: result.data, 
                            target: '_blank',
                            style: 'display:inline-block; margin-top:10px; color:#0066cc;'
                        }, [
                            E('span', {}, ' ' + _('View detailed results'))
                        ])
                    ])
                ]);
            } else if (result.status === 'speed') {
                dom.content(resultDiv, [
                    E('div', { style: 'padding:20px; border-radius:8px;' }, [
                        E('div', { style: 'font-size:18px; font-weight:bold; margin-bottom:10px;' }, _('Test Results:')),
                        E('div', { style: 'font-size:16px; ' }, [
                            E('pre', { style: 'margin:0; font-family:inherit; white-space:pre-wrap;' }, result.data)
                        ])
                    ])
                ]);
            } else if (result.status === 'failed') {
                dom.content(resultDiv, [
                    E('div', { style: 'padding:20px; background:#ffebee; border-radius:8px; color:#c62828;' }, [
                        E('div', { style: 'font-size:18px; font-weight:bold; margin-bottom:10px;' }, _('Test Failed'))
                    ])
                ]);
            } else {
                dom.content(resultDiv, [
                    E('div', { style: 'padding:30px; color:#666;' }, [
                        E('span', { style: 'font-size:48px;' }, ''),
                        E('br'),
                        E('em', {}, _('No test results yet. Click "Click to execute" to begin.'))
                    ])
                ]);
            }
            
            return resultDiv;
        };
        
        // 查看日志按钮
        o = s.option(form.Button, 'view_log', _('View Test Log'));
        o.inputtitle = _('Click to view detailed test log');
        o.inputstyle = 'cbi-button cbi-button-info';
        o.onclick = this.showLog.bind(this);
        
        return m.render();
    },
    
    poll_status: function(nodes, res) {
        var resultContent = (res[2] && res[2].trim) ? res[2].trim().split("\n") : [];
        var resultMtime = (res[3] && res[3].mtime) ? res[3].mtime * 1000 : 0;
        
        var resultStat = nodes.querySelector('#netspeedtest_re');
        var startBtn = nodes.querySelector('.cbi-button-apply');
        
        if (startBtn) {
            startBtn.disabled = this.isTesting(resultContent, resultMtime);
        }
        
        if (resultStat) {
            var result = this.parseResult(resultContent);
            
            if (result.status === 'testing') {
                resultStat.innerHTML = "<div style=' padding:20px;'>" +
                    "<img src='/luci-static/resources/icons/loading.svg' height='32' style='vertical-align:middle; margin-right:10px;'/> " +
                    "<span style='color:green;font-weight:bold; font-size:16px;'>" + _('Speed testing in progress...') + "</span>" +
                    "</div>";
            } else if (result.status === 'url') {
                var imageUrl = result.data;
                if (!imageUrl.match(/\.png$/)) {
                    imageUrl = imageUrl + '.png';
                }
                resultStat.innerHTML = "<div >" +
                    "<a href='" + result.data + "' target='_blank'>" +
                    "<img src='" + imageUrl + "' style='max-width:100%; max-height:400px; border-radius:8px;' " +
                    "</a><br>" +
                    "<a href='" + result.data + "' target='_blank' '>" +
                    " " + _('View detailed results') + "</a>" +
                    "</div>";
            } else if (result.status === 'speed') {
                resultStat.innerHTML = "<div style='padding:20px; border-radius:8px;'>" +
                    "<div style='font-weight:bold; font-size:16px; margin-bottom:10px;'> " + _('Test Results:') + "</div>" +
                    "<pre style='margin:0; font-family:inherit; white-space:pre-wrap;'>" + escapeHTML(result.data) + "</pre>" +
                    "</div>";
            } else if (result.status === 'failed') {
                resultStat.innerHTML = "<div style='padding:20px; background:#ffebee; border-radius:8px; color:#c62828;'>" +
                    "<div style='font-size:18px; font-weight:bold; margin-bottom:10px;'>❌ " + _('Test Failed') + "</div>" +
                    "<div>" + _('Please check system log for details.') + "</div>" +
                    "</div>";
            } else {
                resultStat.innerHTML = "<div style='text-align:center; padding:30px; color:#666;'>" +
                    "<span style='font-size:48px;'></span><br>" +
                    "<em>" + _('No test results yet. Click "Start Speed Test" to begin.') + "</em>" +
                    "</div>";
            }
        }
    },
    
    showLog: function() {
        return fs.read_direct(LOG_FILE)
            .then(function(content) {
                var logContent = content || 'Log file is empty';
                ui.showModal(_('Speed Test Log'), [
                    E('pre', { 
                        style: 'max-height:400px; overflow:auto;  padding:15px; border-radius:4px; font-family:monospace; font-size:12px; white-space:pre-wrap;'
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
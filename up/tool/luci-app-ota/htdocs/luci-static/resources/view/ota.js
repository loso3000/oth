/*
 *  Copyright (C) 2019-2026 author sirpdboy herboy2008@gmail.com github@sirpdboy 
 *  
 *  Licensed to the public under the Apache License 2.0
 */

'use strict';

'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require view';


var callOTACheck = rpc.declare({
    object: 'ota',
    method: 'check'
});

var callOTAInfo = rpc.declare({
    object: 'ota',
    method: 'info'
});

var callOTADownload = rpc.declare({
    object: 'ota',
    method: 'download'
});

var callOTAProgress = rpc.declare({
    object: 'ota',
    method: 'progress'
});

var callOTACancel = rpc.declare({
    object: 'ota',
    method: 'cancel'
});

var callOTAFlash = rpc.declare({
    object: 'ota',
    method: 'do_flash',
    params: ['keep', 'expsize', 'bopkg']
});

// 添加flash_progress的RPC声明
var callOTAFlashProgress = rpc.declare({
    object: 'ota',
    method: 'flash_progress'
});

// 添加get_target_ip的RPC声明
var callOTATargetIP = rpc.declare({
    object: 'ota',
    method: 'get_target_ip',
    params: ['keep', 'expsize']
});


return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(fs.stat('/bin/ota'), null),
            L.resolveDefault(fs.stat('/tmp/firmware.img'), null)
        ]);
    },

    render: function(data) {
        var container = E('div', { class: 'cbi-map' });
        
        var htmlParts = [
            '<style>',
            '.state-ctl .state { display: none !important; }',
            '.state-ctl.state-ctl-unchecked .state.state-unchecked,',
            '.state-ctl.state-ctl-checked .state.state-checked,',
            '.state-ctl.state-ctl-uncheck .state.state-uncheck,',
            '.state-ctl.state-ctl-downloading .state.state-downloading,',
            '.state-ctl.state-ctl-downloaded .state.state-downloaded {',
            '    display: block !important;',
            '}',
            '.keep-options { display: block; }',
            '.hide-keep-options { display: none !important; }',
            '.progress-container {',
            '    width: 100%;',
            '    height: 20px;',
            '    background: rgba(0,0,0,0.2);',
            '    border-radius: 10px;',
            '    display: inline-block;',
            '    margin: 10px 0;',
            '    vertical-align: middle;',
            '    position: relative;',
            '    overflow: hidden;',
            '}',
            '.progress-bar {',
            '    height: 100%;',
            '    background: linear-gradient(90deg, #4CAF50, #8BC34A);',
            '    transition: width 0.3s ease-out;',
            '    position: absolute;',
            '    left: 0;',
            '    top: 0;',
            '}',
            '.progress-text {',
            '    position: absolute;',
            '    width: 100%;',
            '    text-align: center;',
            '    line-height: 20px;',
            '    font-size: 12px;',
            '    font-weight: bold;',
            '    font-size: 12px;',
            '    color: #eee;',
            '    z-index: 1;',
            '    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);',
            '}',
            '.error-message {',
            '    color: #dc3545;',
            '}',
            '.firmware-info {',
            '    padding: 15px;',
            '}',

            '.info-note {',
            '    padding: 10px;',
            '    margin: 10px 0;',
            '    border-radius: 4px;',
            '}',
            '.warning-note {',
            '    background-color: #f8d7da;',
            '    border-left: 4px solid #dc3545;',
            '    padding: 10px;',
            '    margin: 10px 0;',
            '    border-radius: 4px;',
            '}',
            '</style>',
            '<h2 name="content">' + _('OTA Upgrade') + '</h2>',
            '<div class="state-ctl state-ctl-unchecked" id="state-container">',
            '    <div class="cbi-section-descr">',
            '        <div class="info-note">',
            '            1. ' + _('Before expanding and upgrading, use the [Expand Partition] to expand the mnt partition') + '<br>',
            '            2. ' + _('The remaining space is more than twice that of the firmware expansion') + '<br>',
            '            3. ' + _('Expansion firmware DD does not retain configuration flashing') + '<br>',
            '            4. ' + _('Not expanding to the default flashing mode of the system can retain configuration upgrades'),
            '        </div>',
            '    </div>',
            '    <div class="cbi-section cbi-section-node">',
            '        <div class="state state-unchecked">',
            '            <form>',
            '                <div class="cbi-value">',
            '                    <label class="cbi-value-title" id="check_result">' + _('Check update') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <button type="button" class="cbi-button cbi-button-reload" id="btn-check">',
            '                            ' + _('Check update') + '',
            '                        </button>',
            '                        <div class="cbi-value-description">' + _('Step 1/3: Check update') + '</div>',
            '                    </div>',
            '                </div>',
            '            </form>',
            '        </div>',
            '        <div class="state state-uncheck">',
            '            <form>',
            '                <div class="cbi-value">',
            '                    <label class="cbi-value-title" id="check_uncheck">' + _('Check update') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <button type="button" class="cbi-button cbi-button-reload" id="btn-uncheck">',
            '                            ' + _('Check update') + '',
            '                        </button>',
            '                        <div class="cbi-value-description">' + _('Step 1/3: Check update') + '</div>',
            '                    </div>',
            '                </div>',
            '            </form>',
            '        </div>',
            '        <div class="state state-checked">',
            '            <form>',
            '                <div class="cbi-value">',
            '                    <label class="cbi-value-title" id="download_result">' + _('Found new firmware') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <button type="button" class="cbi-button cbi-button-apply" id="btn-download">',
            '                            ' + _('Download firmware') + '',
            '                        </button>',
            '                        <div class="cbi-value-description">' + _('Step 2/3: Download firmware') + '</div>',
            '                    </div>',
            '                </div>',
            '            </form>',
            '        </div>',
            '        <div class="state state-downloading">',
            '            <form>',
            '                <div class="cbi-value">',
            '                    <label class="cbi-value-title" id="download_progress">' + _('Starting download...') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <div class="progress-container">',
            '                            <div id="progress-bar" class="progress-bar" style="width: 0%"></div>',
            '                            <div id="progress-text" class="progress-text">0%</div>',
            '                        </div>',
            '                        <button type="button" class="cbi-button cbi-button-reset" id="btn-cancel">',
            '                            ' + _('Cancel download') + '',
            '                        </button>',
            '                        <div class="cbi-value-description">' + _('Step 2/3: Download firmware') + '</div>',
            '                    </div>',
            '                </div>',
            '            </form>',
            '        </div>',
            '        <div class="state state-downloaded">',
            '            <form id="flash-form">',
            '                <div class="cbi-value">',
            '                    <label class="cbi-value-title" for="expsize">' + _('Select expansion mode') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <select name="expsize" id="expsize" style="width: auto">',
            '                            <option value="0" selected="selected">' + _('No expansion (Sysupgrade)') + '</option>',
            '                            <option value="1">' + _('Expand AUTO (DD Mode)') + '</option>',
            '                            <option value="2">' + _('Expand by 4G (DD Mode)') + '</option>',
            '                            <option value="3">' + _('Expand by 10G (DD Mode)') + '</option>',
            '                            <option value="4">' + _('Expand by 20G (DD Mode)') + '</option>',
            '                            <option value="5">' + _('Expand by 50G (DD Mode)') + '</option>',
            '                            <option value="6">' + _('Expand by 100G (DD Mode)') + '</option>',
            '                        </select>',
            '                    </div>',
            '                </div>',
            '                <div class="cbi-value keep-options" id="keep-settings">',
            '                    <label class="cbi-value-title" for="keep">' + _('Keep settings configuration') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <input type="checkbox" name="keep" value="1" id="keep" checked="checked" />',
            '                    </div>',
            '                </div>',
            '                <div class="cbi-value keep-options" id="keep-plugins">',
            '                    <label class="cbi-value-title" for="bopkg">' + _('Keep installed plugins (test)') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <input type="checkbox" name="bopkg" value="1" id="bopkg" checked="checked" />',
            '                    </div>',
            '                </div>',
            '                <div class="cbi-value">',
            '                    <label class="cbi-value-title">' + _('Flash Mode Information') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <div id="flash-mode-info" >',
            '                            <strong>' + _('Current selection:') + '</strong> <span id="current-mode">' + _('Sysupgrade mode') + '</span><br>',
            '                            <strong>' + _('Default IP after flash:') + '</strong> <span id="target-ip">' + _('Loading...') + '</span><br>',
            '                            <strong>' + _('Settings Save:') + '</strong> <span id="settings-preservation">' + _('Enabled') + '</span>',
            '                        </div>',
            '                    </div>',
            '                </div>',
            '                <div class="cbi-value cbi-value-last">',
            '                    <label class="cbi-value-title">' + _('Firmware downloaded') + '</label>',
            '                    <div class="cbi-value-field">',
            '                        <button type="submit" class="cbi-button cbi-input-apply" id="flashimage-btn">',
            '                            ' + _('Flash image') + '',
            '                        </button>',
            '                        <div class="cbi-value-description">' + _('Step 3/3: Flash image') + '</div>',
            '                    </div>',
            '                </div>',
            '            </form>',
            '        </div>',
            '    </div>',
            '    <div class="state state-uncheck state-checked state-downloading state-downloaded">',
            '        <div class="cbi-section-descr">',
            '            <h2>' + _('Upgrade Log') + '</h2>',
            '            <div id="upgrade_log"></div>',
            '        </div>',
            '    </div>',
            '</div>'
        ];
        
        container.innerHTML = htmlParts.join('');

        var self = this;
        
        setTimeout(function() {
            self.initDOM();
            self.bindEvents();
            self.checkFirmwareFile();
	    
            self.fetchFirmwareInfoFromRPC().then(function(firmwareInfo) {
                if (firmwareInfo) {

                    if (self.dom.upgradeLog) {
                        self.displayFirmwareInfo(firmwareInfo);
                    }
                }
            });
            setTimeout(function() {
                self.checkForActiveDownload();
            }, 500);
            
            setTimeout(function() {
                self.autoResumeDownload();
            }, 1500);
            
        }, 100);

        return container;
    },

    initDOM: function() {
        this.dom = {
            stateCtl: document.querySelector('#state-container'),
            checkBtn: document.querySelector('#btn-check'),
            uncheckBtn: document.querySelector('#btn-uncheck'),
            downloadBtn: document.querySelector('#btn-download'),
            cancelBtn: document.querySelector('#btn-cancel'),
            flashBtn: document.querySelector('#flashimage-btn'),
            checkResult: document.querySelector('#check_result'),
            checkuncheck: document.querySelector('#check_uncheck'),
            downloadProgress: document.querySelector('#download_progress'),
            upgradeLog: document.querySelector('#upgrade_log'),
            expsizeSelect: document.querySelector('#expsize'),
            keepSettings: document.querySelector('#keep-settings'),
            keepPlugins: document.querySelector('#keep-plugins'),
            flashForm: document.querySelector('#flash-form'),
            progressBar: document.querySelector('#progress-bar'),
            progressText: document.querySelector('#progress-text'),
            flashModeInfo: document.querySelector('#flash-mode-info'),
            currentMode: document.querySelector('#current-mode'),
            targetIp: document.querySelector('#target-ip'),
            settingsPreservation: document.querySelector('#settings-preservation'),
            contentContainer: document.querySelector('#maincontent')
        };
        
        // 初始化进度跟踪变量
        this.lastProgress = 0;
        this.lastUpdateTime = null;
        this.progressTimer = null;
        this.flashProgressTimer = null;
        this.progressHistory = [];
        this.maxHistoryLength = 10;
        this.firmwareInfo = null;
        this.targetIP = '192.168.10.1'; // 默认IP
        this.currentIP = window.location.hostname || '192.168.10.1';
        
        // 更新flash模式信息
        this.updateFlashModeInfo();
    },

    bindEvents: function() {
        var self = this;
        
        // 检查更新按钮
        if (this.dom.checkBtn) {
            this.dom.checkBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.onCheck();
            });
        }
        
        // 下载按钮
        if (this.dom.downloadBtn) {
            this.dom.downloadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.onDownload();
            });
        }
        
        // 取消按钮
        if (this.dom.cancelBtn) {
            this.dom.cancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.onCancel();
            });
        }
        
        // 刷写表单
        if (this.dom.flashForm) {
            this.dom.flashForm.addEventListener('submit', function(e) {
                e.preventDefault();
                self.onFlash(e);
            });
        }
        
        // 扩展模式选择
        if (this.dom.expsizeSelect) {
            this.dom.expsizeSelect.addEventListener('change', function() {
                self.updateKeepOptionsVisibility();
                self.updateFlashModeInfo();
            });
        }
        
        // Keep选项变化
        if (this.dom.keepSettings) {
            var keepCheckbox = this.dom.keepSettings.querySelector('#keep');
            if (keepCheckbox) {
                keepCheckbox.addEventListener('change', function() {
                    self.updateFlashModeInfo();
                });
            }
        }
    },

    // 更新flash模式信息
    updateFlashModeInfo: function() {
        if (!this.dom.expsizeSelect || !this.dom.currentMode || !this.dom.targetIp || !this.dom.settingsPreservation) return;
        
        var expsize = parseInt(this.dom.expsizeSelect.value) || 0;
        var keepCheckbox = this.dom.keepSettings.querySelector('#keep');
        var keep = keepCheckbox ? keepCheckbox.checked : true;
        callOTATargetIP(keep ? 1 : 0, expsize).then(function(response) {
            if (response && response.target_ip) {
                this.targetIP = response.target_ip;
                this.dom.targetIp.textContent = this.targetIP;
            }
        }.bind(this)).catch(function(error) {
            if (keep && expsize === 0) {
                this.targetIP = this.currentIP;
            } else {
                this.targetIP = this.firmwareInfo ? this.firmwareInfo.ip : '192.168.10.1';
            }
            this.dom.targetIp.textContent = this.targetIP;
        }.bind(this));
        var mode = expsize === 0 ? _('Sysupgrade mode') : _('DD mode (Expansion)');
        this.dom.currentMode.textContent = mode;
        
        var settingsStatus;
        if (expsize === 0) {
            settingsStatus = keep ? _('Enabled (Settings preserved)') : _('Disabled (Fresh install)');
        } else {
            settingsStatus = _('Disabled (DD mode does not preserve settings)');
        }
        this.dom.settingsPreservation.textContent = settingsStatus;
    },


formatDateString: function(dateStr) {
    if (!dateStr || dateStr.length !== 8) {
        return dateStr || _('Unknown');
    }
    try {
        var year = dateStr.substring(0, 4);
        var month = dateStr.substring(4, 6);
        var day = dateStr.substring(6, 8);

        if (parseInt(month) < 1 || parseInt(month) > 12 || 
            parseInt(day) < 1 || parseInt(day) > 31) {
            return dateStr;
        }
        
        return year + '-' + month + '-' + day;
    } catch (e) {
        return dateStr;
    }
},

parseFirmwareInfo: function(message) {
    try {
        if (!message) {
            return null;
        }
        
        var jsonStart = message.indexOf('{');
        var jsonEnd = message.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
            var jsonStr = message.substring(jsonStart, jsonEnd + 1);
            var data = JSON.parse(jsonStr);

            if (data.x86_64 && Array.isArray(data.x86_64) && data.x86_64.length > 0) {
                var firmware = data.x86_64[0];
                
                return {
                    version: firmware.ver || _('Unknown'),
                    name: firmware.name || _('Unknown'),
                    size: firmware.size || '0',
		    partsize: firmware.partsize || '0',
                    date: this.formatDateString(firmware.date) || _('Unknown'),
                    md5: firmware.md5 || _('Unknown'),
                    ip: firmware.ip || '192.168.10.1',
                    url: firmware.url || _('Unknown')
                };
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
},

fetchFirmwareInfoFromRPC: function() {
    var self = this;
    
    return callOTAInfo().then(function(response) {
        if (response && response.code === 0) {
            var firmwareInfo = self.parseFirmwareInfo(response.msg);
            
            if (firmwareInfo) {
                self.firmwareInfo = firmwareInfo;
                self.updateFlashModeInfo();
                return firmwareInfo;
            }
        } else {
        }
        
        self.firmwareInfo = null;
        return null;
    }).catch(function(error) {
        self.firmwareInfo = null;
        return null;
    });
},

    // 显示固件信息
    displayFirmwareInfo: function(firmwareInfo) {
        if (!firmwareInfo || !this.dom.upgradeLog) return;
        
        var html = '<div class="firmware-details">' +
                   '<table>' +
                   '<tr><td>' + _('Version:') + '</td><td>' + this.escapeHtml(firmwareInfo.version) + '</td></tr>' +
                   '<tr><td>' + _('File Name:') + '</td><td>' + this.escapeHtml(firmwareInfo.name) + '</td></tr>' +
                   '<tr><td>' + _('Size:') + '</td><td>' + this.escapeHtml(firmwareInfo.size) + ' MB</td></tr>' +
                   '<tr><td>' + _('Part Size:') + '</td><td>' + this.escapeHtml(firmwareInfo.partsize) + ' MB</td></tr>' +
                   '<tr><td>' + _('Release Date:') + '</td><td>' + this.escapeHtml(firmwareInfo.date) + '</td></tr>' +
                   '<tr><td>' + _('MD5:') + '</td><td><code>' + this.escapeHtml(firmwareInfo.md5) + '</code></td></tr>' +
                   '<tr><td>' + _('Default IP:') + '</td><td>' + this.escapeHtml(firmwareInfo.ip) + '</td></tr>' +
                   '</table>' +
                   '</div>';
        
        this.dom.upgradeLog.innerHTML = html;
    },

    // 检查固件文件
    checkFirmwareFile: function() {
        var self = this;
        
        fs.stat('/tmp/firmware.img')
            .then(function(stats) {
                if (stats && stats.size > 10 * 1024 * 1024) {
                    // 检查文件是否还在增长（可能正在下载）
                    var currentSize = stats.size;
                    
                    // 延迟再次检查文件大小，看是否在增长
                    setTimeout(function() {
                        fs.stat('/tmp/firmware.img')
                            .then(function(newStats) {
                                if (newStats && newStats.size > currentSize) {
                                    self.switchState('downloading');
                                    
                                    // 重置进度跟踪
                                    self.lastProgress = 0;
                                    self.progressHistory = [];
                                    
                                    // 开始进度监控
                                    self.startProgressMonitor();
                                    
                                    // 显示进度条
                                    self.updateProgressDisplay(0, _('Resuming download...'));
                                } else {
                                    self.switchState('downloaded');
                                    if (self.dom.upgradeLog) {
                                        var sizeMB = Math.round(stats.size / 1024 / 1024);
                                        if (self.firmwareInfo) {
                                            self.dom.upgradeLog.innerHTML = 
                                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                                '<h4>✓ ' + _('Firmware Ready') + '</h4>' +
                                                '<div class="firmware-details">' +
                                                '<table>' +
                                                '<tr><td>' + _('File:') + '</td><td>/tmp/firmware.img</td></tr>' +
                                                '<tr><td>' + _('Size:') + '</td><td>' + sizeMB + ' MB</td></tr>' +
                                                '<tr><td>' + _('Part Size:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.partsize) + ' MB</td></tr>' +
                                                '<tr><td>' + _('Version:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.version) + '</td></tr>' +
                                                '<tr><td>' + _('Release Date:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.date) + '</td></tr>' +
                                                '<tr><td>' + _('MD5:') + '</td><td><code>' + self.escapeHtml(self.firmwareInfo.md5) + '</code></td></tr>' +
                                                '<tr><td>' + _('Default IP:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.ip) + '</td></tr>' +
                                                '</table>' +
                                                '</div>' +
                                                '</div>';
                                        } else {
                                            // 没有固件信息，显示基本文件信息
                                            self.dom.upgradeLog.innerHTML = 
                                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                                '<h4>✓ ' + _('Firmware Ready') + '</h4>' +
                                                '<div>' + _('File:') + ' /tmp/firmware.img</div>' +
                                                '<div>' + _('Size:') + ' ' + sizeMB + ' MB</div>' +
                                                '</div>';
                                        }
                                    }
                                }
                            })
                            .catch(function() {
                                // 文件访问失败
                            });
                    }, 1000); // 1秒后检查
                } else {
                    // 文件太小或不存在，检查是否有正在进行的下载
                    self.checkForActiveDownload();
                }
            })
            .catch(function(error) {
                // 没有固件文件，检查是否有正在进行的下载
                self.checkForActiveDownload();
            });
    },

    // 检查是否有活动的下载
    checkForActiveDownload: function() {
        var self = this;
        
        // 检查下载进度
        callOTAProgress().then(function(response) {
            if (response && response.code === 1) {
                self.switchState('downloading');
                
                // 重置进度跟踪
                self.lastProgress = 0;
                self.progressHistory = [];
                self.dom.upgradeLog.innerHTML = 
                                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                                '<div>' + _('Resuming download monitoring...') + '</div>' +
                                                '</div>';
                
                // 开始进度监控
                self.startProgressMonitor();
                
                // 解析当前进度
                var percent = self.parseProgressBar(response.msg);
                self.updateProgressDisplay(percent, response.msg);
                
            } else if (response && response.code === 0) {
                // 下载已完成但文件可能被删除
            } else {
                // 没有活动的下载
            }
        }).catch(function(error) {
        });
    },

    // 自动恢复下载监控
    autoResumeDownload: function() {
        var self = this;
        
        // 检查文件是否存在且正在增长
        fs.stat('/tmp/firmware.img')
            .then(function(stats) {
                if (stats && stats.size > 0) {
                    // 记录当前大小
                    var initialSize = stats.size;
                    
                    // 等待2秒后再次检查
                    setTimeout(function() {
                        fs.stat('/tmp/firmware.img')
                            .then(function(newStats) {
                                if (newStats && newStats.size > initialSize) {
                                    self.dom.upgradeLog.innerHTML = 
                                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                                '<div>' + _('Auto-resume: File is growing, download active') + '</div>' +
                                                '</div>';
               
                                    self.switchState('downloading');
                                    self.startProgressMonitor();
                                }
                            })
                            .catch(function() {
                                // 忽略错误
                            });
                    }, 2000);
                }
            })
            .catch(function() {
                // 文件不存在
            });
    },

onCheck: function() {
    var btn = this.dom.checkBtn;
    var result = this.dom.checkResult;
    var self = this;
    
    if (!btn || btn.disabled) return;
    
    btn.disabled = true;
    btn.textContent = _('Checking...');
    result.textContent = _('Checking for updates...');
    
    
    // 使用RPCD调用
    L.resolveDefault(callOTACheck(), {})
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = _('Check update');
            
            if (!response) {
                result.textContent = _('No response');
                return;
            }
            var code = response.code;
            var message = response.msg;

                if (self.dom.upgradeLog) {
                        self.dom.upgradeLog.innerHTML = message;
                }
           switch(code) {
                case 0:  
                // 检查是否有更新
                    if (message.includes('云端版本') && message.includes('当前版本') || firmwareInfo) {
                    // 有更新
                    result.textContent = _('Update available!');
                    result.className = 'update-available';
                    self.switchState('checked');
                } else {
                    result.textContent = _('Check completed');
                }
             break; 
	  case 1:  
	     // 最新版
		    self.switchState('uncheck');
                    self.dom.checkuncheck.textContent = _('latest version');
		    self.dom.uncheckBtn.disabled = true;
                    break;
          default:
                // 检查失败
                result.textContent = _('Check failed');
                result.className += ' error-message';
           }
            
        })
        .catch(function(error) {
            btn.disabled = false;
            btn.textContent = _('Check update');
            result.textContent = _('Check failed');
                result.className += ' error-message';
        });
},


    // 下载固件
    onDownload: function() {
        var btn = this.dom.downloadBtn;
        var self = this;
        
        if (!btn || btn.disabled) return;
        
        btn.disabled = true;
        btn.textContent = _('Downloading...');
        
        // 清除历史记录
        this.progressHistory = [];
        
        
        // 重置进度显示
        this.updateProgressDisplay(0, _('Starting download...'));
        
        // 重置进度跟踪
        this.lastProgress = 0;
        
        // 切换到下载状态
        this.switchState('downloading');

        self.dom.upgradeLog.innerHTML = 
                                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                                '<div>' + _('Starting download...') + '</div>' +
                                                '</div>';
        
        // 先启动进度监控
        this.startProgressMonitor();
        
        // 然后启动下载
        L.resolveDefault(callOTADownload(), {})
            .then(function(response) {
            
                if (response && response.code === 0) {
                    
                    // 恢复按钮状态
                    btn.disabled = false;
                    btn.textContent = _('Download firmware');
                    self.switchState('checked');
                }
            })
            .catch(function(error) {
                // 恢复按钮状态
                btn.disabled = false;
                btn.textContent = _('Download firmware');
                self.switchState('checked');
            });
    },

    // 更新进度显示
    updateProgressDisplay: function(percent, message) {
        if (!this.dom.progressBar || !this.dom.progressText) return;
        
        // 限制百分比范围
        percent = Math.max(0, Math.min(100, percent));
        
        // 更新进度条
        this.dom.progressBar.style.width = percent + '%';
        
        // 更新进度文本
        var displayText = percent.toFixed(1) + '%';

        this.dom.progressText.textContent = displayText;
        // 更新进度消息
        if (this.dom.downloadProgress) {
            var shortMessage = _('Downloading:') + this.parseProgressBar(message)+ '%';
            this.dom.downloadProgress.textContent = shortMessage;
        }

    },

    // 解析进度百分比 - 支持多种格式
    parseProgressPercent: function(message) {
        if (!message) return 0;
        
        var percent = 0;
        
        // 格式1: 进度条格式 "##### 1%" 或 "####### 10%" 或 "[### ] 30%"
        var progressBarMatch = message.match(/([#=\.\-\[\]\s]+)\s*(\d+(?:\.\d+)?)%/);
        if (progressBarMatch) {
            percent = parseFloat(progressBarMatch[2]);
            return percent;
        }
        
        // 格式2: 纯百分比格式 "75.9%" 或 "75%"
        var percentMatch = message.match(/(\d+(?:\.\d+)?)%/);
        if (percentMatch) {
            percent = parseFloat(percentMatch[1]);
            return percent;
        }
        
        // 格式3: 带标签的百分比 "进度: 75.9%" 或 "progress: 75.9%"
        var labeledMatch = message.match(/[\:：]\s*(\d+(?:\.\d+)?)%/);
        if (labeledMatch) {
            percent = parseFloat(labeledMatch[1]);
            return percent;
        }
        
        // 格式4: 分数格式 "1/100" 或 "30/100"
        var fractionMatch = message.match(/(\d+)\s*\/\s*(\d+)/);
        if (fractionMatch) {
            var numerator = parseFloat(fractionMatch[1]);
            var denominator = parseFloat(fractionMatch[2]);
            if (denominator > 0) {
                percent = (numerator / denominator) * 100;
                return percent;
            }
        }
        
        // 格式5: 带括号的百分比 "(10%)" 或 "[20%]"
        var bracketedMatch = message.match(/[\(\[\{]\s*(\d+(?:\.\d+)?)%\s*[\)\]\}]/);
        if (bracketedMatch) {
            percent = parseFloat(bracketedMatch[1]);
            return percent;
        }
        
        // 格式6: 进度条长度估算（如果有#或=字符）
        var barCharsMatch = message.match(/[#=]/g);
        if (barCharsMatch) {
            var barMatch = message.match(/\[([#= ]+)\]/);
            if (barMatch) {
                var barContent = barMatch[1];
                var totalLength = barContent.length;
                var filledLength = (barContent.match(/[#=]/g) || []).length;
                if (totalLength > 0) {
                    percent = (filledLength / totalLength) * 100;
                    return percent;
                }
            }
            
            var totalLength = message.length;
            var filledLength = barCharsMatch.length;
            if (filledLength >= 3 && filledLength >= totalLength * 0.3) {
                percent = (filledLength / totalLength) * 100;
                return percent;
            }
        }
        var rangeMatch = message.match(/(\d+)\s+(?:of|out of|from)\s+(\d+)/i);
        if (rangeMatch) {
            var current = parseFloat(rangeMatch[1]);
            var total = parseFloat(rangeMatch[2]);
            if (total > 0) {
                percent = (current / total) * 100;
                return percent;
            }
        }
        
        return percent;
    },

    // 专门的进度条解析函数
    parseProgressBar: function(message) {
        if (!message) return 0;
        
        // 常见进度条格式
        var patterns = [
            // 格式: "##### 10%"
            /([#=\.\-]+)\s+(\d+(?:\.\d+)?)%/,
            
            // 格式: "[#####     ] 30%"
            /\[([#=\.\- ]+)\]\s*(\d+(?:\.\d+)?)%/,
            
            // 格式: "10% [#####....]"
            /(\d+(?:\.\d+)?)%\s*\[([#=\.\- ]+)\]/,
            
            // 格式: "Progress: [###   ] 25%"
            /progress:\s*\[([#=\.\- ]+)\]\s*(\d+(?:\.\d+)?)%/i,
            
            // 格式: "Downloading: ##### 50%"
            /downloading:\s*([#=\.\-]+)\s*(\d+(?:\.\d+)?)%/i
        ];
        
        for (var i = 0; i < patterns.length; i++) {
            var match = message.match(patterns[i]);
            if (match && match[2]) {
                return parseFloat(match[2]);
            }
        }
        return this.parseProgressPercent(message);
    },

    // 检查进度的方法
    checkProgress: function() {
        var self = this;
        
        if (!this.progressTimer) return;
        callOTAProgress().then(function(response) {
            
            if (!response) {
                return;
            }
            var code = response.code;
            var message = response.msg;
            switch(code) {
                case 0: // 下载完成
                    self.updateProgressDisplay(100, _('Download complete!'));
                    self.checkDownloadedFile();
                    if (self.progressTimer) {
                        clearInterval(self.progressTimer);
                        self.progressTimer = null;
                    }
                    setTimeout(function() {
                        self.switchState('downloaded');
                        if (self.dom.downloadBtn) {
                            self.dom.downloadBtn.disabled = false;
                            self.dom.downloadBtn.textContent = _('Download firmware');
                        }
                    }, 1500);
                    break;
                    
                case 1: 
                    var percent = self.parseProgressBar(message);
                    
                    if (percent > 0) {
                        if (percent > self.lastProgress) {
                            self.lastProgress = percent;
                        }
                        self.updateProgressDisplay(percent, message);

                    } else {
                        var timePercent = Math.min(95, Math.floor(self.checkCount / 18)); // 30分钟对应100%
                        self.updateProgressDisplay(timePercent, _('Downloading...') + ' (' + self.checkCount + 's)');
                    }
                    if (self.dom.upgradeLog) {
                        var displayMsg = message;
                        if (displayMsg.length > 300) {
                            displayMsg = displayMsg.substring(0, 297) + '...';
                        }
                    }
                    break;
                    
                case 2: // 已取消
                    
                    self.updateProgressDisplay(0, _('Download cancelled'));
                    self.switchState('checked');
                    if (self.dom.downloadBtn) {
                        self.dom.downloadBtn.disabled = false;
                        self.dom.downloadBtn.textContent = _('Download firmware');
                    }
                    
                    if (self.progressTimer) {
                        clearInterval(self.progressTimer);
                        self.progressTimer = null;
                    }
                    break;
                    
                case 254: // 下载未进行或出错
                    fs.stat('/tmp/firmware.img')
                        .then(function(stats) {
                            if (stats && stats.size > 10 * 1024 * 1024) {
                                self.checkDownloadedFile();
                                self.switchState('downloaded');
                                
                                if (self.progressTimer) {
                                    clearInterval(self.progressTimer);
                                    self.progressTimer = null;
                                }
                            } else {
                            }
                        })
                        .catch(function() {
                        });
                    break;
                    
                default:
                    fs.stat('/tmp/firmware.img')
                        .then(function(stats) {
                            if (stats && stats.size > 10 * 1024 * 1024) {
                                self.checkDownloadedFile();
                                self.switchState('downloaded');
                            }
                        })
                        .catch(function() {
                        });
            }
        }).catch(function(error) {
        });
    },

    startProgressMonitor: function() {
        var self = this;
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        
        this.checkCount = 0;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 5;
        
        // 先立即检查一次进度
        self.checkProgress();
        
        // 启动定时器
        this.progressTimer = setInterval(function() {
            self.checkCount++;
            
            // 30分钟超时
            if (self.checkCount > 1800) {
                self.switchState('checked');
                
                if (self.progressTimer) {
                    clearInterval(self.progressTimer);
                    self.progressTimer = null;
                }
                
                // 恢复下载按钮
                if (self.dom.downloadBtn) {
                    self.dom.downloadBtn.disabled = false;
                    self.dom.downloadBtn.textContent = _('Download firmware');
                }
                return;
            }
            
            // 检查进度
            self.checkProgress();
        }, 1000); // 每秒检查一次
    },

    // 检查下载的文件
    checkDownloadedFile: function() {
        var self = this;
        
        fs.stat('/tmp/firmware.img')
            .then(function(stats) {
                if (stats && stats.size > 10 * 1024 * 1024) {
                    var sizeMB = Math.round(stats.size / 1024 / 1024);
                    if (self.dom.upgradeLog) {
                        // 如果有固件信息，显示详细信息
                        if (self.firmwareInfo) {
                            self.dom.upgradeLog.innerHTML = 
                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                '<h4>✓ ' + _('Download Complete!') + '</h4>' +
                                '<div class="firmware-details">' +
                                '<table>' +
                                '<tr><td>' + _('File:') + '</td><td>/tmp/firmware.img</td></tr>' +
                                '<tr><td>' + _('Size:') + '</td><td>' + sizeMB + ' MB (' + _('Expected:') + ' ' + self.firmwareInfo.size + ' MB)</td></tr>' +
                                '<tr><td>' + _('Part Size:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.partsize) + ' MB</td></tr>' +
                                '<tr><td>' + _('Version:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.version) + '</td></tr>' +
                                '<tr><td>' + _('Release Date:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.date) + '</td></tr>' +
                                '<tr><td>' + _('MD5:') + '</td><td><code>' + self.escapeHtml(self.firmwareInfo.md5) + '</code></td></tr>' +
                                '<tr><td>' + _('Default IP:') + '</td><td>' + self.escapeHtml(self.firmwareInfo.ip) + '</td></tr>' +
                                '</table>' +
                                '</div>' +
                                '</div>';
                        } else {
                            // 没有固件信息，显示基本文件信息
                            self.dom.upgradeLog.innerHTML = 
                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                '<h4>✓ ' + _('Download Complete!') + '</h4>' +
                                '<div>' + _('Firmware downloaded successfully.') + '</div>' +
                                '<div>' + _('File:') + ' /tmp/firmware.img</div>' +
                                '<div>' + _('Size:') + ' ' + sizeMB + ' MB</div>' +
                                '</div>';
                        }
                    }
                }
            })
            .catch(function(error) {
                // 文件不存在或无法访问
            });
    },

    // 取消下载
    onCancel: function() {
        var btn = this.dom.cancelBtn;
        var self = this;
        
        if (!btn || btn.disabled) return;
        
        btn.disabled = true;
        btn.textContent = _('Cancelling...');
        
        
        L.resolveDefault(callOTACancel(), {})
            .then(function(response) {
                
                btn.disabled = false;
                btn.textContent = _('Cancel download');

                self.dom.upgradeLog.innerHTML = 
                                                '<div class="firmware-info" style="border-left-color: #28a745;">' +
                                                '<div>' + _('Download cancellation confirmed') + '</div>' +
                                                '</div>';
                
                self.switchState('checked');
                if (self.dom.downloadBtn) {
                    self.dom.downloadBtn.disabled = false;
                    self.dom.downloadBtn.textContent = _('Download firmware');
                }
                
                if (self.progressTimer) {
                    clearInterval(self.progressTimer);
                    self.progressTimer = null;
                }
            })
            .catch(function(error) {
                btn.disabled = false;
                btn.textContent = _('Cancel download');
            });
    },

    // 切换状态
    switchState: function(to) {
        if (!this.dom.stateCtl) return;

        this.dom.stateCtl.classList.remove(
            'state-ctl-unchecked',
            'state-ctl-checked', 
            'state-ctl-uncheck', 
            'state-ctl-downloading',
            'state-ctl-downloaded'
        );
        
        // 添加新状态类
        this.dom.stateCtl.classList.add('state-ctl-' + to);
    },

    updateKeepOptionsVisibility: function() {
        if (!this.dom.expsizeSelect || !this.dom.keepSettings || !this.dom.keepPlugins) return;
        
        var showOptions = this.dom.expsizeSelect.value === "0";
        
        if (showOptions) {
            this.dom.keepSettings.classList.remove('hide-keep-options');
            this.dom.keepPlugins.classList.remove('hide-keep-options');
            this.dom.keepSettings.style.display = 'block';
            this.dom.keepPlugins.style.display = 'block';
        } else {
            this.dom.keepSettings.classList.add('hide-keep-options');
            this.dom.keepPlugins.classList.add('hide-keep-options');
            this.dom.keepSettings.style.display = 'none';
            this.dom.keepPlugins.style.display = 'none';
        }
    },

    escapeHtml: function(text) {
        if (text === null || text === undefined) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    checkFlashProgress: function() {
        var self = this;
        callOTAFlashProgress().then(function(response) {
            
            if (!response) {
                setTimeout(function() {
                    self.checkFlashProgress();
                }, 2000);
                return;
            }
            if (response.progress !== undefined && self.dom.flashProgressBar) {
                var progress = Math.min(100, Math.max(0, response.progress));
                self.dom.flashProgressBar.style.width = progress + '%';
                if (self.dom.flashProgressText) {
                    self.dom.flashProgressText.textContent = progress.toFixed(0) + '%';
                }
            }
            if (response.message && self.dom.flashStatusMessage) {
                self.dom.flashStatusMessage.textContent = response.message;
            }
            if (response.log && self.dom.flashLogOutput) {
                self.dom.flashLogOutput.textContent = response.log;
                self.dom.flashLogOutput.scrollTop = self.dom.flashLogOutput.scrollHeight;
                if (self.dom.flashLogCount) {
                    var lines = response.log.split('\n').length;
                    self.dom.flashLogCount.textContent = lines + ' ' + _('lines');
                }
            }
            
// 处理状态变化
if (response.status === 'complete' || response.status === 'rebooting') {
    var rebootMessage = response.message || _('Flash completed! Device is rebooting...');
    self.dom.flashStatusMessage.textContent = rebootMessage;
    if (self.dom.flashButtons) {
        self.dom.flashButtons.style.display = 'block';
    }
    
    var delaySeconds = 45;
    var countdownElement = document.createElement('div');
    countdownElement.style.marginTop = '10px';
    countdownElement.style.fontWeight = 'bold';
    countdownElement.style.color = '#4CAF50';
    countdownElement.id = 'reconnect-countdown';
    countdownElement.textContent = _('Will attempt to reconnect in') + ' ' + delaySeconds + ' ' + _('seconds');
    self.dom.flashStatusMessage.parentNode.appendChild(countdownElement);
    
    // 开始倒计时
    var countdown = delaySeconds;
    var countdownTimer = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            countdownElement.textContent = _('Will attempt to reconnect in') + ' ' + countdown + ' ' + _('seconds');
        } else {
            clearInterval(countdownTimer);
            countdownElement.textContent = _('Attempting to reconnect now...');
            self.startReconnect();
        }
    }, 1000);
    
    return; 

            } else if (response.status === 'failed') {
                self.showFlashError(response.message);
                return; 
            } else if (response.status === 'running' || response.status === 'upgrading' || 
                       response.status === 'flashing' || response.status === 'preparing' ||
                       response.status === 'verifying' || response.status === 'expanding' ||
                       response.status === 'finalizing') {
                // 如果还在进行中，继续检查
                setTimeout(function() {
                    self.checkFlashProgress();
                }, 1000);
            } else {
                // 未知状态，继续检查
                setTimeout(function() {
                    self.checkFlashProgress();
                }, 2000);
            }
        }).catch(function(error) {
            if (error && error.message && (error.message.includes('not found') || 
                error.message.includes('Access denied'))) {
                setTimeout(function() {
                    self.checkFlashProgress();
                }, 3000);
            } else {
                setTimeout(function() {
                    self.checkFlashProgress();
                }, 2000);
            }
        });
    },

    // 尝试重新连接设备
    startReconnect: function() {
        var self = this;
        var reconnectAttempts = 0;
        var maxReconnectAttempts = 30;
        
        function checkConnection() {
            reconnectAttempts++;
            if (self.dom.flashStatusMessage) {
                self.dom.flashStatusMessage.textContent = 
                    _('Device rebooting... Attempting to reconnect (') + reconnectAttempts + '/' + maxReconnectAttempts + ')';
            }
            fetch('http://' + self.targetIP + '/cgi-bin/luci', {
                mode: 'no-cors',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            })
            .then(function() {
                // 连接成功，跳转到新地址
                window.location.href = 'http://' + self.targetIP;
            })
            .catch(function(error) {
                
                if (reconnectAttempts < maxReconnectAttempts) {
                    // 继续尝试
                    setTimeout(checkConnection, 2000);
                } else {
                    if (self.dom.flashStatusMessage) {
                        self.dom.flashStatusMessage.textContent = 
                            _('Could not reconnect automatically. Please try to access:') + ' ' + 
                            self.targetIP + ' ' + _('manually.');
                    }
                    var manualBtn = document.createElement('button');
                    manualBtn.className = 'cbi-button cbi-input-apply';
                    manualBtn.textContent = _('Go to') + ' ' + self.targetIP;
                    manualBtn.style.marginTop = '20px';
                    manualBtn.addEventListener('click', function() {
                        window.location.href = 'http://' + self.targetIP;
                    });
                    self.dom.flashStatusMessage.parentNode.appendChild(manualBtn);
                    
                }
            });
        }
        setTimeout(checkConnection, 5000);
    },
    onFlash: function(e) {
        e.preventDefault();
        
        var form = e.target;
        var expsize = parseInt(form.querySelector('#expsize').value) || 0;
        var keep = form.querySelector('#keep').checked ? 1 : 0;
        var bopkg = form.querySelector('#bopkg').checked ? 1 : 0;
        var mode = expsize === 0 ? _('Sysupgrade') : _('DD (Expansion)');
        
        var confirmMessage;
        if (expsize === 0) {
            confirmMessage = _('Are you sure you want to flash the firmware using %s mode?').format(mode) + '\n\n' +
                           _('Settings Save:') + ' ' + (keep ? _('YES') : _('NO')) + '\n' +
                           _('Plugins preservation:') + ' ' + (bopkg ? _('YES') : _('NO')) + '\n' +
                           _('Default IP after flash:') + ' ' + this.targetIP + '\n\n' +
                           _('The device will reboot!');
        } else {
            var sizes = ['0','1', '4G', '10G', '20G', '50G', '100G'];
            var size = sizes[expsize];
            confirmMessage = _('Are you sure you want to flash the firmware using %s mode?').format(mode) + '\n\n' +
                           _('⚠️ WARNING: DD mode does NOT preserve settings!') + '\n' +
                           _('Expansion size:') + ' ' + size + '\n' +
                           _('Default IP after flash:') + ' ' + this.targetIP + '\n\n' +
                           _('The device will reboot!');
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        var flashBtn = form.querySelector('#flashimage-btn');
        flashBtn.disabled = true;
        flashBtn.textContent = _('Flashing...');
        
        var self = this;
        this.showFlashProgress();
        L.resolveDefault(callOTAFlash(keep, expsize, bopkg), {})
            .then(function(response) {
                if (response && response.code === 0) {
                    if (response.target_ip) {
                        self.targetIP = response.target_ip;
                    }
                    if (self.dom.flashStatusMessage) {
                        self.dom.flashStatusMessage.textContent = response.msg || _('Flash process started');
                    }
                    setTimeout(function() {
                        self.checkFlashProgress();
                    }, 1000);
                } else {
                    var errorMsg = response && response.msg ? response.msg : _('Unknown error');
                    self.showFlashError(errorMsg);
                }
            })
            .catch(function(error) {
                self.showFlashError(_('Flash request failed:') + ' ' + error.message);
            });
    },

    // 显示刷机进度页面
    showFlashProgress: function() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 9998;';
        var progressPage = document.createElement('div');
        progressPage.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%;  height: 100%; z-index: 9999; display: flex; align-items: center; justify-content: center;';
        var progressContent = document.createElement('div');
        progressContent.style.cssText = 'background: rgba(39, 39, 39, 0.95);color: rgb(255, 255, 255,0.7);max-width: 800px;width: 600px;min-width: 300px;text-align: center;padding: 1%;border-radius: 12px;box-shadow: rgba(0, 0, 0, 0.5) 0px 15px 40px;position: relative;';
        
        var htmlParts = [
            '<h1 style="margin-bottom: 5px;color: #ddd;text-align: center;font-size: 1.1rem;">' + _('Firmware Upgrade') + '</h1>',
            '<div class="status-message" style="font-size: 0.92rem;text-align: center;color: #4CAF50;margin-bottom: 10px;">' + _('Preparing flash process...') + '</div>',
            '<div style="display: flex;align-items: center;justify-content: center;flex-direction: column;">',
            '    <div style="width: 100%;">',
            '        <div class="progress-container">',
            '              <div id="flash-progress-bar" class="progress-bar" style="width: 0%"></div>',
            '                    <div id="flash-progress-text" class="progress-text">0%</div>',
            '         </div>',

            '        <div style="display: flex;flex-direction: column;align-items: center;justify-content: center;">',
	    '           <div class="spinner" style="width: 50px;height: 50px;border: 6px solid rgba(255,255,255,0.1);border-radius: 50%;border-top-color: #007bff;animation: spin 1s ease-in-out infinite;"></div>',
            '           <div style="margin: 0;text-align: center;"> ',
	    '                  <div id="flash-status-message" class="status-message" style="margin: 0;margin-top: 10px;text-align: center;color: #bbb;"></div>',
            '           </div>',
            '        </div>',
            '    </div>',
            '</div>',
            '<div style="margin-top: 5px;">',
            '    <div style="display: flex;justify-content: flex-end;align-items: center;margin-bottom: 5px;">',
            '        <div id="flash-log-count" style="background: #444; text-align: left;font-size: small;color: #aaa; padding: 3px 10px; border-radius: 12px; font-size: 12px;">0 ' + _('lines') + '</div>',
            '    </div>',
            '    <pre id="flash-log-output" style="max-height: 250px; text-align: left;height: 200px;overflow-y: auto; background: #222; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.4; color: #eee; margin: 0; white-space: pre-wrap;"></pre>',
            '</div>',
            '<div id="flash-buttons" style="margin-top: 25px; display: none; text-align: center;">',
            '    <button id="flash-manual-btn" class="cbi-button cbi-input-reset" style="padding: 10px 30px; font-size: 16px;">' + _('Manual Access') + '</button>',
            '</div>',
            '<style>',
            '@keyframes spin { to { transform: rotate(360deg); } }',
            '#flash-log-output::-webkit-scrollbar { width: 8px; }',
            '#flash-log-output::-webkit-scrollbar-track { background: #333; border-radius: 4px; }',
            '#flash-log-output::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }',
            '#flash-log-output::-webkit-scrollbar-thumb:hover { background: #666; }',
            '.cbi-button { border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.3s; }',
            '.cbi-button:hover { opacity: 0.9; transform: translateY(-1px); }',
            '.cbi-input-apply { background: linear-gradient(135deg, #4CAF50, #2E7D32); color: white; }',
            '.cbi-input-reset { background: linear-gradient(135deg, #f44336, #c62828); color: white; }',
            '</style>'
        ];
        
        progressContent.innerHTML = htmlParts.join('');
        
        // 将内容添加到页面
        progressPage.appendChild(progressContent);
        if (this.dom.contentContainer) {
            var oldOverlay = document.querySelector('.flash-overlay');
            var oldProgress = document.querySelector('.flash-progress-container');
            if (oldOverlay) oldOverlay.remove();
            if (oldProgress) oldProgress.remove();
            overlay.className = 'flash-overlay';
            progressPage.className = 'flash-progress-container';
            document.body.appendChild(overlay);
            document.body.appendChild(progressPage);
            this.dom.flashProgressBar = document.querySelector('#flash-progress-bar');
            this.dom.flashProgressText = document.querySelector('#flash-progress-text');
            this.dom.flashStatusMessage = document.querySelector('#flash-status-message');
            this.dom.flashLogOutput = document.querySelector('#flash-log-output');
            this.dom.flashLogCount = document.querySelector('#flash-log-count');
            this.dom.flashButtons = document.querySelector('#flash-buttons');
            var manualBtn = document.querySelector('#flash-manual-btn');
            var self = this;

            if (manualBtn) {
                manualBtn.addEventListener('click', function() {
                    window.open('http://' + self.targetIP, '_blank');
                });
            }
        }
    },

    showFlashError: function(errorMsg) {
        if (this.dom.flashStatusMessage) {
            this.dom.flashStatusMessage.textContent = _('Error:') + ' ' + errorMsg;
            this.dom.flashStatusMessage.style.color = '#ff6b6b';
            if (this.dom.flashButtons) {
                this.dom.flashButtons.style.display = 'block';
            }
        }
    },
    cleanupFlashOverlay: function() {
        var overlay = document.querySelector('.flash-overlay');
        var progress = document.querySelector('.flash-progress-container');
        if (overlay) overlay.remove();
        if (progress) progress.remove();
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
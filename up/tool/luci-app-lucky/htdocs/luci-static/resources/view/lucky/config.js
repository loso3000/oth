'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';

const callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '' : {} }
});

// 修正 RPC 声明 - 根据后端代码，get_ConfInfo 不需要参数
const getLuckyConfig = rpc.declare({
    object: 'luci.lucky',
    method: 'get_ConfInfo',
    expect: { 'ConfInfo': {} }  // 修正 expect 结构
});

// 修正 set_ConfInfo 声明
const setLuckyConfig = rpc.declare({
    object: 'luci.lucky',
    method: 'set_ConfInfo',
    params: ['key', 'value', 'configPath'],
    expect: { 'status': 0 }
});

// 服务状态检测
function getServiceStatus() {
    return L.resolveDefault(callServiceList('lucky'), {}).then((res) => {
        console.debug('Service status res:', res);
        let isRunning = false;
        try {
            if (res.lucky) {
                // 修复服务状态检测逻辑
                if (res.lucky.instances) {
                    // 检查所有实例
                    for (let instance in res.lucky.instances) {
                        if (res.lucky.instances[instance].running) {
                            isRunning = true;
                            break;
                        }
                    }
                }
                // 或者直接检查 running 状态
                if (res.lucky.running) {
                    isRunning = true;
                }
            }
        } catch (e) { 
            console.error('Service status error:', e);
        }
        return isRunning;
    }).catch((error) => {
        console.error('Service status check failed:', error);
        return false;
    });
}

// 配置获取函数
function loadLuckyConfig() {
    return L.resolveDefault(getLuckyConfig(), {}).then((result) => {
        console.debug('RPC config result:', result);
        
        // 根据后端返回结构处理数据
        if (result.ConfInfo) {
            return { ConfInfo: result.ConfInfo };
        } else if (result.error) {
            console.error('RPC config error:', result.error);
            return { ConfInfo: {} };
        } else {
            return { ConfInfo: {} };
        }
    }).catch((error) => {
        console.error('RPC config call failed:', error);
        return { ConfInfo: {} };
    });
}

// 渲染状态函数
function renderStatus(isRunning, baseConfig, protocol, version) {
    let spanTemp = '<em><span style="color:%s"><strong>%s %s - %s</strong></span></em>';
    let renderHTML;
    
    const webport = baseConfig?.BaseConfigure?.AdminWebListenPort || '16601';
    const safe_url = baseConfig?.BaseConfigure?.SafeURL || '';
    
    if (isRunning) {
        let buttonUrl = String.format('%s//%s:%s/', protocol, window.location.hostname, webport);
        
        if (safe_url && safe_url.trim() !== '') {
            buttonUrl = String.format('%s%s/', buttonUrl, safe_url);
        }
        
        const button = String.format(
            '<input class="cbi-button cbi-button-reload" type="button" style="margin-left: 20px" value="%s" onclick="window.open(\'%s\')">',
            _('Open Web Interface'), 
            buttonUrl
        );
        
        renderHTML = spanTemp.format('green', 'Lucky', version, _('RUNNING')) + button;
        
        // 显示配置信息
        renderHTML += String.format(
            '<div style="margin-top: 10px; color: #666;">%s: %s, %s: %s</div>',
            _('Admin Port'),
            webport,
            _('Safe Entrance'), 
            safe_url || _('Not set')
        );
    } else {
        renderHTML = spanTemp.format('red', 'Lucky', version, _('NOT RUNNING'));
        
        // 即使未运行也显示配置信息
        if (baseConfig && baseConfig.BaseConfigure) {
            renderHTML += String.format(
                '<div style="margin-top: 10px; color: #666;">%s: %s, %s: %s</div>',
                _('Admin Port'),
                webport,
                _('Safe Entrance'),
                safe_url || _('Not set')
            );
        }
    }
    
    return renderHTML;
}

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('lucky'),
        ]);
    },

    render: function(data) {
        var m, s, o;
        
        var configdir = uci.get('lucky', 'lucky', 'configdir') || '/etc/lucky';
        var uci_ssl = uci.get('lucky', 'lucky', 'ssl') || '0';
        var version = '1.0'; 
        var protocol;
        if (uci_ssl === '0') {
            protocol = 'http:';
        } else if (uci_ssl === '1') {
            protocol = 'https:';
        }

        console.debug('uci_ssl,protocol,configdir:', uci_ssl, protocol, configdir);
        
        m = new form.Map('lucky', _('Lucky Configuration'),
            _('Lucky automatically obtains your public IPv4 or IPv6 address and resolves it to the corresponding domain name service.'));

        // 状态显示部分
        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.addremove = false;

        s.render = function() {
            poll.add(function() {
                return Promise.all([
                    L.resolveDefault(getServiceStatus()),
                    L.resolveDefault(loadLuckyConfig())
                ]).then(function(results) {
                    const [isRunning, configData] = results;
                    const baseConfig = configData?.ConfInfo || {};
                    
                    console.debug('=== FINAL RESULTS ===');
                    console.debug('isRunning:', isRunning);
                    console.debug('configData:', configData);
                    console.debug('baseConfig:', baseConfig);
                    console.debug('BaseConfigure:', baseConfig?.BaseConfigure);
                    
                    var view = document.getElementById('service_status');
                    view.innerHTML = renderStatus(isRunning, baseConfig, protocol, version);
                }).catch(function(error) {
                    console.error('Polling error:', error);
                    var view = document.getElementById('service_status');
                    view.innerHTML = String.format(
                        '<div style="color: red;">%s: %s</div>',
                        _('Error'),
                        error.message || error
                    );
                });
            });

            return E('div', { class: 'cbi-section', id: 'status_bar' }, [
                E('div', { id: 'service_status' }, 
                    E('p', {}, _('Collecting data...'))
                )
            ]);
        };

        // 配置部分
        s = m.section(form.NamedSection, 'lucky', 'lucky');

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = o.disabled;
        o.rmempty = false;

        // 端口配置选项
        o = s.option(form.Value, 'port', _('Set the Lucky access port'));
		o.default = '16601';
		o.rmempty = false;

        o.write = function(section_id, formvalue) {
            uci.set('lucky', section_id, 'port', formvalue);
            
            const portMatch = formvalue.match(/:(\d+)$/);
            if (portMatch && portMatch[1]) {
                const portNumber = portMatch[1];
                
                return L.resolveDefault(setLuckyConfig('AdminWebListenPort', portNumber, configdir))
                    .then(function(result) {
                        if (result.status !== 0) {
                            ui.addNotification(null, E('p', _('Failed to update Lucky configuration')), 'error');
                        }
                        return uci.save();
                    })
                    .catch(function(error) {
                        ui.addNotification(null, E('p', _('Error updating Lucky configuration: ') + error), 'error');
                        return uci.save();
                    });
            }
            
            return uci.save();
        };

        // 安全入口配置选项
        o = s.option(form.Value, 'safe', _('Safe entrance'));
        o.default = '';
        o.datatype = 'string';
        o.write = function(section_id, formvalue) {
            uci.set('lucky', section_id, 'safe', formvalue || '');
            
            return L.resolveDefault(setLuckyConfig('SafeURL', formvalue || '', configdir))
                .then(function(result) {
                    if (result.status !== 0) {
                        ui.addNotification(null, E('p', _('Failed to update SafeURL configuration')), 'error');
                    }
                    return uci.save();
                })
                .catch(function(error) {
                    ui.addNotification(null, E('p', _('Error updating SafeURL configuration: ') + error), 'error');
                    return uci.save();
                });
        };

        o = s.option(form.Flag, 'ssl', _('Enable SSL'));
        o.default = '0';
        o.rmempty = false;

        o = s.option(form.Value, 'configdir', _('Config directory path'));
        o.default = '/etc/lucky';
        o.placeholder = '/etc/lucky';
        o.datatype = 'directory';
        o.validate = function(section_id, value) {
            if (!value || value.trim() === '') {
                return _('Config directory path cannot be empty');
            }
            return true;
        };
        
        return m.render();
    }
});

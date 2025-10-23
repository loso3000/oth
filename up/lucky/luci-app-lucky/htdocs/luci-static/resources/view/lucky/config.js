//   Copyright (C) 2021-2025 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-lucky 

'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';
'require fs';

async function checkProcess() {
    try {
        const pidofRes = await fs.exec('/bin/pidof', ['lucky']);
        if (pidofRes.code === 0) {
            return {
                running: true,
                pid: pidofRes.stdout.trim()
            };
        }
    } catch (err) {
        // pidof 失败，继续尝试 ps
    }
    try {
        const psRes = await fs.exec('/bin/ps', ['-C', 'lucky', '-o', 'pid=']);
        const pid = psRes.stdout.trim();
        return {
            running: pid !== '',
            pid: pid || null
        };
    } catch (err) {
        return { running: false, pid: null };
    }
}

const getLuckyConfig = rpc.declare({
    object: 'luci.lucky',
    method: 'get_Info',
    expect: { 'Info': {} }
});

function getServiceStatus() {
    return L.resolveDefault(checkProcess(), {}).then(function(res) {
        let isRunning = false;
        // console.debug('getServiceStatus res:', res);
        try {
            if (res && res.running) {
                isRunning = true;
            }
        } catch (e) { 
            console.error('Service status error:', e);
        }
        return isRunning;
    }).catch(function(error) {
        console.error('Service status check failed:', error);
        return false;
    });
}

function loadLuckyVer() {
    return L.resolveDefault(getLuckyConfig(), {}).then(function(result) {
        // console.debug('loadLuckyVer result:', result);
        // 确保返回正确的版本信息结构
        return result.Version || 'Unknown';
    });
}

function renderStatus(isRunning, webport, safe_url, protocol, version) {
    let statusText = isRunning ? _('RUNNING') : _('NOT RUNNING');
    let color = isRunning ? 'green' : 'red';
    let icon = isRunning ? '✓' : '✗';
    let html = String.format(
        '<em><span style="color:%s">%s <strong>%s %s - %s</strong></span></em>',
        color, icon, _('Lucky'), version, statusText
    );

    if (isRunning) {
        let buttonUrl = String.format('%s//%s:%s/', protocol, window.location.hostname, webport);
        
        if (safe_url && safe_url.trim() !== '') {
            buttonUrl = String.format('%s%s/', buttonUrl, safe_url);
        }
        
        html += String.format(
            '<input class="cbi-button cbi-button-reload" type="button" style="margin-left: 20px" value="%s" onclick="window.open(\'%s\')">',
            _('Open Web Interface'), 
            buttonUrl
        );
    }
    
    return html;
}

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('lucky')
        ]);
    },

    render: function(data) {
        let m, s, o;
        let webport = uci.get('lucky', 'lucky', 'port') || '16601';
        let safeurl = uci.get('lucky', 'lucky', 'safe') || '';
        let uci_ssl = uci.get('lucky', 'lucky', 'ssl') || '0';
        let protocol = uci_ssl === '1' ? 'https:' : 'http:';
        
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
                    L.resolveDefault(loadLuckyVer())
                ]).then(function(results) {
                    const [isRunning, version] = results;
                    
                    // console.debug('Poll results:', results);
                    // console.debug('isRunning:', isRunning);
                    // console.debug('version:', version);

                    var view = document.getElementById('service_status');
                    if (view) {
                        view.innerHTML = renderStatus(isRunning, webport, safeurl, protocol, version);
                    }
                }).catch(function(error) {
                    console.error('Poll error:', error);
                });
            }, 5); // 添加轮询间隔5秒
            
            return E('div', { class: 'cbi-section', id: 'status_bar' }, [
                E('div', { id: 'service_status' }, 
                    E('p', {}, _('Collecting data...'))
                )
            ]);
        };

        s = m.section(form.NamedSection, 'lucky', 'lucky');

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = o.disabled;
        o.rmempty = false;

        o = s.option(form.Value, 'port', _('Set the Lucky access port'));
        o.default = '16601';
        o.rmempty = false;
        o.datatype = 'port';
        o.validate = function(section_id, value) {
            if (value < 1 || value > 65535) {
                return _('Port must be between 1 and 65535');
            }
            return true;
        };

        o = s.option(form.Value, 'safe', _('Safe entrance')); 
        o.default = '';
        o.datatype = 'string';

        o = s.option(form.Flag, 'ssl', _('Enable SSL'));
        o.default = '0';
        o.rmempty = false;
        
        return m.render();
    }
});
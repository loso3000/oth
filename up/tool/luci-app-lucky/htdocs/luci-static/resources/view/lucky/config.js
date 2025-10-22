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

// RPC 声明
const getLuckyConfig = rpc.declare({
    object: 'luci.lucky',
    method: 'get_Info',
    expect: { 'Info': {} }
});

// 服务状态检测
function getServiceStatus() {
    return L.resolveDefault(callServiceList('lucky'), {}).then((res) => {
        let isRunning = false;
        try {
            if (res.lucky && res.lucky.instances) {
                for (let instance in res.lucky.instances) {
                    if (res.lucky.instances[instance].running) {
                        isRunning = true;
                        break;
                    }
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

function loadLuckyInfo() {
    return L.resolveDefault(getLuckyConfig(), {}).then((result) => {
         //console.debug('loadLuckyInfo result:', result);
    

            return { Ver: result.Version };
    });
}

// 渲染状态函数
function renderStatus(isRunning, webport,safe_url, protocol, version) {
    let spanTemp = '<em><span style="color:%s"><strong>%s %s - %s</strong></span></em>';
    let renderHTML;

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

    } else {
        renderHTML = spanTemp.format('red', 'Lucky', version, _('NOT RUNNING'));
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
        var webport = uci.get('lucky', 'lucky', 'port') || '16601';
        var safeurl = uci.get('lucky', 'lucky', 'safeurl') || '';
        var uci_ssl = uci.get('lucky', 'lucky', 'ssl') || '0';
        var version = '3.0'; 
        var protocol = uci_ssl === '1' ? 'https:' : 'http:';
        
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
                    L.resolveDefault(loadLuckyInfo())
                ]).then(function(results) {
		    
                    const [isRunning, infoData] = results;
                    const version = infoData?.Ver || '3.0';
                    
                    var view = document.getElementById('service_status');
                    view.innerHTML = renderStatus(isRunning, webport,safeurl, protocol, version);
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

        s = m.section(form.NamedSection, 'lucky', 'lucky');

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = o.disabled;
        o.rmempty = false;

        o = s.option(form.Value, 'port', _('Set the Lucky access port'));
        o.default = '16601';
        o.rmempty = false;

        o = s.option(form.Value, 'safe', _('Safe entrance'));
        o.default = '';
        o.datatype = 'string';

        o = s.option(form.Flag, 'ssl', _('Enable SSL'));
        o.default = '0';
        o.rmempty = false;
        
        return m.render();
    }
});

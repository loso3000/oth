'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require form';
'require poll';
'require rpc';
'require network';

// 检查服务进程状态
function checkTimeControlProcess() {
    return fs.exec('/bin/pidof', ['timecontrol']).then(function(res) {
        return {
            running: res.code === 0,
            pid: res.code === 0 ? res.stdout.trim() : null
        };
    }).catch(function() {
        return { running: false, pid: null };
    });
}

// 渲染服务状态显示
function renderServiceStatus(isRunning, pid) {
    var statusText = isRunning ? _('RUNNING') : _('NOT RUNNING');
    var color = isRunning ? 'green' : 'red';
    var icon = isRunning ? '✓' : '✗'; 
    
    var statusHtml = String.format(
        '<em><span style="color:%s">%s <strong>%s %s</strong></span></em>',
        color, icon, _('TimeControl Service'), statusText
    );
    
    if (isRunning && pid) {
        statusHtml += ' <small>(PID: ' + pid + ')</small>';
    }
    
    return statusHtml;
}

// 自定义带描述的列表选项
var cbiRichListValue = form.ListValue.extend({
    renderWidget: function(section_id, option_index, cfgvalue) {
        var choices = this.transformChoices();
        var widget = new ui.Dropdown((cfgvalue != null) ? cfgvalue : this.default, choices, {
            id: this.cbid(section_id),
            sort: this.keylist,
            optional: true,
            select_placeholder: this.select_placeholder || this.placeholder,
            custom_placeholder: this.custom_placeholder || this.placeholder,
            validate: L.bind(this.validate, this, section_id),
            disabled: (this.readonly != null) ? this.readonly : this.map.readonly
        });

        return widget.render();
    },

    value: function(value, title, description) {
        if (description) {
            form.ListValue.prototype.value.call(this, value, E([], [
                E('span', { 'class': 'hide-open' }, [title]),
                E('div', { 'class': 'hide-close', 'style': 'min-width:25vw' }, [
                    E('strong', [title]),
                    E('br'),
                    E('span', { 'style': 'white-space:normal' }, description)
                ])
            ]));
        } else {
            form.ListValue.prototype.value.call(this, value, title);
        }
    }
});

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('timecontrol'),
            network.getDevices()
        ]);
    },

    render: function(data) {
        var m, s, o;

        m = new form.Map('timecontrol', _('Internet Time Control'),
            _('Users can limit their internet usage time through MAC and IP, with available IP ranges such as 192.168.110.00 to 192.168.10.200') + '<br/>' +
            _('Suggested feedback:') + ' <a href="https://github.com/sirpdboy/luci-app-timecontrol.git" target="_blank">GitHub @sirpdboy/luci-app-timecontrol</a>');

        // 服务状态显示区域
        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.render = function() {
            var statusView = E('p', { id: 'service_status' }, 
                '<span class="spinning"> </span> ' + _('Checking service status...'));
            
            poll.add(function() {
                return checkTimeControlProcess()
                    .then(function(res) {
                        var status = renderServiceStatus(res.running, res.pid);
                        statusView.innerHTML = status;
                    })
                    .catch(function(err) {
                        statusView.innerHTML = '<span style="color:orange">⚠ ' + 
                            _('Status check failed') + '</span>';
                        console.error('Status check error:', err);
                    });
            });

            poll.start();
            return E('div', { class: 'cbi-section', id: 'status_bar' }, [ 
                statusView,
                E('div', { 'style': 'text-align: right; font-style: italic;' }, [
                    E('span', {}, [
                        _('© github '),
                        E('a', { 
                            'href': 'https://github.com/sirpdboy', 
                            'target': '_blank',
                            'style': 'text-decoration: none;'
                        }, 'by sirpdboy')
                    ])
                ])
            ]);
        };

        // 配置区域
        s = m.section(form.TypedSection, 'timecontrol');
        s.anonymous = true;

        // 控制模式
        o = s.option(cbiRichListValue, 'list_type', _('Control Mode'),
            _('blacklist: Block the networking of the target address, whitelist: Only allow networking for the target address and block all other addresses.'));
        o.rmempty = false;
        o.value('blacklist', _('Blacklist'));
        o.value('whitelist', _('Whitelist'));
        o.default = 'blacklist';

        // 控制强度
        o = s.option(cbiRichListValue, 'chain', _('Control Intensity'),
            _('Pay attention to strong control: machines under control will not be able to connect to the software router backend!'));
        o.rmempty = false;
        o.value('forward', _('Ordinary forwarding control'));
        o.value('input', _('Strong inbound control'));
        o.default = 'forward';

        // 设备规则区域
        s = m.section(form.GridSection, 'device', _('Device Rules'));
        s.anonymous = true;
        s.addremove = true;
        s.sortable = true;

        // 注释
        o = s.option(form.Value, 'comment', _('Comment'));
        o.size = 8;

        // 启用状态
        o = s.option(form.Flag, 'enable', _('Enabled'));
        o.rmempty = false;
        o.size = 4;

        // IP/MAC地址
        o = s.option(form.Value, 'mac', _('IP/MAC'));
        o.size = 8;

        // 填充IP/MAC下拉选项
        L.resolveDefault(network.getHostHints()).then(function(hosts) {
            hosts.forEach(function(host) {
                if (host.ipv4 && host.mac) {
                    o.value(host.ipv4, '%s (%s)'.format(host.ipv4, host.mac));
                    o.value(host.mac, '%s (%s)'.format(host.mac, host.ipv4));
                }
                if (host.ipv6 && host.mac) {
                    o.value(host.ipv6, '%s (%s)'.format(host.ipv6, host.mac));
                }
            });
        });



        // 开始时间
        o = s.option(form.Value, 'timestart', _('Start Control Time'));
        o.placeholder = '00:00';
        o.default = '00:00';

        o.rmempty = true;
        o.size = 4;

        // 结束时间
        o = s.option(form.Value, 'timeend', _('Stop Control Time'));
        o.placeholder = '00:00';
        o.default = '00:00';
        o.validate = function(section_id, value) {
            if (!validateTime(value)) {
                return _('Invalid time format (HH:MM)');
            }
            return true;
        };
        o.rmempty = true;
        o.size = 4;

        // 星期几
        o = s.option(form.ListValue, 'week', _('Week Day (1~7)'));
        o.rmempty = true;
        o.value('0', _('Everyday'));
        o.value('1', _('Monday'));
        o.value('2', _('Tuesday'));
        o.value('3', _('Wednesday'));
        o.value('4', _('Thursday'));
        o.value('5', _('Friday'));
        o.value('6', _('Saturday'));
        o.value('7', _('Sunday'));
        o.value('1,2,3,4,5', _('Workday'));
        o.value('6,7', _('Rest Day'));
        o.default = '0';
        o.size = 6;

        return m.render();
    }
});
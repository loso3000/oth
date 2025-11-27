/*   Copyright (C) 2022-2025 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-eqosplus */
'use strict';
'require form';
'require network';
'require uci';
'require view';
'require rpc';
'require ui';
'require fs';
'require poll';

function checkProcess() {
    return fs.exec('/bin/pidof', ['eqosplusctl']).then(function(res) {
        return {
            running: res.code === 0,
            pid: res.code === 0 ? res.stdout.trim() : null
        };
    }).catch(function() {
        return { running: false, pid: null };
    });
}

function renderStatus(isRunning) {
    var statusText = isRunning ? _('RUNNING') : _('NOT RUNNING');
    var color = isRunning ? 'green' : 'red';
    var icon = isRunning ? '✓' : '✗'; 
    
    return String.format(
        '<em><span style="color:%s">%s <strong>%s %s</strong></span></em>',
        color, icon, _('eqosplus'), statusText
    );
}

var cbiRichListValue = form.ListValue.extend({
    renderWidget: function (section_id, option_index, cfgvalue) {
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

    value: function (value, title, description) {
        if (description) {
            form.ListValue.prototype.value.call(this, value, E([], [
                E('span', { 'class': 'hide-open' }, [title]),
                E('div', { 'class': 'hide-close', 'style': 'min-width:25vw' }, [
                    E('strong', [title]),
                    E('br'),
                    E('span', { 'style': 'white-space:normal' }, description)
                ])
            ]));
        }
        else {
            form.ListValue.prototype.value.call(this, value, title);
        }
    }
});

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('eqosplus'),
            network.getHostHints(),
            this.getWanInterfaces(),
            this.getNetworkDevices()
        ]);
    },

    getWanInterfaces: function() {
        return rpc.list('network.interface', 'dump', {})
            .then(function(reply) {
                var interfaces = [];
                if (reply && reply.interface) {
                    reply.interface.forEach(function(iface) {
                        if (iface.interface.match(/^wan/) || 
                            iface.interface.match(/^pppoe/) || 
                            iface.proto === 'pppoe') {
                            var dev = iface.l3_device || iface.device;
                            if (dev) {
                                interfaces.push({
                                    name: dev,
                                    proto: iface.proto,
                                    logical_name: iface.interface,
                                    display: dev + (iface.proto === 'pppoe' ? ' (PPPoE)' : ' (WAN)')
                                });
                            }
                        }
                    });
                }
                return interfaces;
            })
            .catch(function(err) {
                console.error('Failed to get WAN interfaces:', err);
                return [];
            });
    },

    getNetworkDevices: function() {
        return Promise.all([
            this.getDHCPLeases(),
            this.getARPTable()
        ]).then(function(results) {
            var dhcpDevices = results[0];
            var arpDevices = results[1];
            var allDevices = [];
            var seenIPs = {};

            dhcpDevices.forEach(function(dev) {
                allDevices.push(dev);
                seenIPs[dev.ip] = true;
            });

            arpDevices.forEach(function(dev) {
                if (!seenIPs[dev.ip]) {
                    allDevices.push(dev);
                    seenIPs[dev.ip] = true;
                }
            });

            allDevices.sort(function(a, b) {
                return a.ip.localeCompare(b.ip);
            });

            return allDevices;
        });
    },

    getDHCPLeases: function() {
        return rpc.list('dhcp', 'ipv4leases', {})
            .then(function(reply) {
                var devices = [];
                if (reply && reply.length > 0) {
                    reply.forEach(function(lease) {
                        if (lease.ipaddr && lease.mac) {
                            var hostname = lease.hostname || 'unknown';
                            devices.push({
                                ip: lease.ipaddr,
                                mac: lease.mac.toUpperCase(),
                                hostname: hostname,
                                display: lease.ipaddr + ' (' + lease.mac.toUpperCase() + ') - ' + hostname
                            });
                        }
                    });
                }
                return devices;
            })
            .catch(function(err) {
                console.error('Failed to get DHCP leases:', err);
                return [];
            });
    },

    getARPTable: function() {
        return fs.exec_direct('/usr/bin/ip', ['-4', 'neigh', 'show', 'dev', 'br-lan'])
            .then(function(output) {
                var devices = [];
                var lines = output ? output.trim().split('\n') : [];
                
                lines.forEach(function(line) {
                    var match = line.match(/^(\S+)\s+.+\s+(\S+)\s+/);
                    if (match && match[1] && match[2] && match[2] !== '00:00:00:00:00:00') {
                        var ip = match[1];
                        var mac = match[2].toUpperCase();
                        var hostname = 'unknown';
                        
                        devices.push({
                            ip: ip,
                            mac: mac,
                            hostname: hostname,
                            display: ip + ' (' + mac + ') - ' + hostname
                        });
                    }
                });
                
                return devices;
            })
            .catch(function(err) {
                console.error('Failed to get ARP table:', err);
                return [];
            });
    },

    render: function(data) {
        var m, s, o, t;

        var uciData = data[0];
        var hostHints = data[1];
        var wanInterfaces = data[2];
        var networkDevices = data[3];

        m = new form.Map('eqosplus', '',
            _('Users can limit the network speed for uploading/downloading through MAC, IP, and IP segments (192.168.110.00-192.168.10.200). The speed unit is MB/second.'));
        
        s = m.section(form.TypedSection);
        s.anonymous = true;
    
        s.render = function() {
            var statusView = E('p', { id: 'control_status' }, 
                '<span class="spinning"> </span> ' + _('Checking status...'));
            
            poll.add(function() {
                return checkProcess()
                    .then(function(res) {
                        var status = renderStatus(res.running);
                        if (res.running && res.pid) {
                            status += ' <small>(PID: ' + res.pid + ')</small>';
                        }
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

        s = m.section(form.TypedSection, 'eqosplus', '');
        s.anonymous = true;

        // 启用开关
        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = '0';
        o.rmempty = false;

        // 接口选择
        o = s.option(form.ListValue, 'ifname', _('Interface'),
            _('Set the interface used for restriction, use pppoe-wan for dialing, use WAN hardware interface for DHCP mode (such as eth1), and use br-lan for bypass mode'));
        o.default = '1';
        o.value('1', _('Automatic settings'));
        o.value('br-lan', _('br-lan (LAN Bridge)'));

        wanInterfaces.forEach(function(iface) {
            o.value(iface.name, iface.display);
        });

        // 限速规则部分
        t = m.section(form.TableSection, 'device', '');
        t.anonymous = true;
        t.addremove = true;

        // Comment
        o = t.option(form.Value, 'comment', _('Comment'));
        o.size = 8;

        // Enabled flag
        o = t.option(form.Flag, 'enable', _('Enabled'));
        o.rmempty = false;
        o.size = 4;
        o.default = o.enabled;

        // IP/MAC selection
        o = t.option(form.Value, 'mac', _('IP/MAC'));
        o.size = 8;

        // Populate IP/MAC dropdown with network devices
        networkDevices.forEach(function(dev) {
            o.value(dev.ip, dev.display);
        });

        // Download speed
        o = t.option(form.Value, 'download', _('Downloads (MB/s)'));
        o.default = '0.1';
        o.size = 4;
        o.datatype = 'float';
        o.placeholder = '0.1';

        // Upload speed
        o = t.option(form.Value, 'upload', _('Uploads (MB/s)'));
        o.default = '0.1';
        o.size = 4;
        o.datatype = 'float';
        o.placeholder = '0.1';

        // Start control time
        o = t.option(form.Value, 'timestart', _('Start control time'));
        o.placeholder = '00:00';
        o.default = '00:00';
        o.size = 4;
        o.rmempty = true;

        // Stop control time
        o = t.option(form.Value, 'timeend', _('Stop control time'));
        o.placeholder = '00:00';
        o.default = '00:00';
        o.size = 4;
        o.rmempty = true;

        // Week days
        o = t.option(form.Value, 'week', _('Week Day(1~7)'));
        o.rmempty = true;
        o.size = 6;
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

        return m.render();
    }
});
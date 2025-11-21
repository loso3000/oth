'use strict';
'require form';
'require network';
'require uci';
'require view';
'require rpc';
'require ui';

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

            // 合并设备，去除重复
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

            // 按IP地址排序
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

    validateTime: function(value) {
        var timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(value)) {
            return 'Time format should be HH:MM';
        }
        return true;
    },

    render: function(data) {
        var m, s, o, t;

        var uciData = data[0];
        var hostHints = data[1];
        var wanInterfaces = data[2];
        var networkDevices = data[3];

        m = new form.Map('eqosplus', _('Network Speed Limit'),
            _('Users can limit the network speed for uploading/downloading through MAC, IP. The speed unit is MB/second.') + ' ' +
            _('Suggested feedback:') + ' ' +
            _('<a href="https://github.com/sirpdboy/luci-app-eqosplus.git" target="_blank">GitHub @sirpdboy/luci-app-eqosplus</a>'));

        // Status section
        s = m.section(form.NamedSection, 'eqosplus', 'eqosplus');
        s.anonymous = true;

        o = s.option(form.DummyValue, 'eqosplus_status', _('Status'));
        o.default = _('Collecting data...');

        // Interface selection
        o = s.option(form.ListValue, 'ifname', _('Interface'),
            _('Set the interface used for restriction, use pppoe-wan for dialing, use WAN hardware interface for DHCP mode (such as eth1), and use br-lan for bypass mode'));
        o.default = '1';
        o.value('1', _('Automatic settings'));
        o.value('br-lan', _('br-lan (LAN Bridge)'));

        wanInterfaces.forEach(function(iface) {
            o.value(iface.name, iface.display);
        });

        // Devices table section
        t = m.section(form.TableSection, 'device', _('Speed Limit Rules'));
        t.template = 'cbi/tblsection';
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

        // Add manual MAC option for devices not in the list
        o.value('manual', _('Manual MAC entry'));

        // Download speed
        o = t.option(form.Value, 'download', _('Downloads'));
        o.default = '0.1';
        o.size = 4;
        o.datatype = 'float';
        o.placeholder = '0.1';

        // Upload speed
        o = t.option(form.Value, 'upload', _('Uploads'));
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
        o.validate = this.validateTime;

        // Stop control time
        o = t.option(form.Value, 'timeend', _('Stop control time'));
        o.placeholder = '00:00';
        o.default = '00:00';
        o.size = 4;
        o.rmempty = true;
        o.validate = this.validateTime;

        // Week days
        o = t.option(form.ListValue, 'week', _('Week Day(1~7)'));
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

        // Add JavaScript for dynamic MAC input
        m.on('init', function() {
            var sections = document.querySelectorAll('.cbi-section-table-row');
            sections.forEach(function(section) {
                var macInput = section.querySelector('input[name="mac"]');
                if (macInput && macInput.value === 'manual') {
                    macInput.type = 'text';
                    macInput.placeholder = 'Enter MAC address';
                    macInput.pattern = '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$';
                }
            });
        });

        // Handle MAC input changes
        m.on('change', function(ev) {
            var target = ev.target;
            if (target.name === 'mac' && target.value === 'manual') {
                target.type = 'text';
                target.placeholder = 'Enter MAC address';
                target.pattern = '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$';
                target.value = '';
            } else if (target.name === 'mac' && target.value !== 'manual') {
                target.type = 'select';
            }
        });

        return m.render();
    }
});
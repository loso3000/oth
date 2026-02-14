'use strict';
'require baseclass';
'require view';
'require ui';
'require rpc';
'require fs';

// 继承 View 基类
return view.extend({
    callMenuConfig: rpc.declare({
        object: 'luci',
        method: 'getMenuConfig',
        params: ['']
    }),

    callSetMenuConfig: rpc.declare({
        object: 'luci',
        method: 'setMenuConfig',
        params: ['config']
    }),

    title: _('KuCat Menu Configuration'),

    load: function() {
        return Promise.all([
            this.loadAllMenus(),
            this.loadBasicMenus()
        ]);
    },

    /**
     * 获取所有菜单 - 修复异步加载问题
     */
    loadAllMenus: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            var menus = [];
            var menuSet = new Set();
            
            try {
                // 先确保菜单已加载
                ui.menu.load().then(function() {
                    // 获取菜单树 - 使用与主题相同的方法
                    var menuTree = ui.menu.getTree();
                    
                    if (!menuTree || !menuTree.children) {
                        console.debug('No menu tree available');
                        resolve(self.getFallbackMenus());
                        return;
                    }
                    
                    // 递归收集菜单的函数
                    function collectMenus(node, parentPath) {
                        if (!node) return;
                        
                        // 获取当前节点的子菜单
                        var children = ui.menu.getChildren(node);
                        
                        children.forEach(function(child) {
                            if (child && child.title) {
                                var currentPath = parentPath ? parentPath + '/' + child.name : child.name;
                                
                                if (!menuSet.has(currentPath)) {
                                    menuSet.add(currentPath);
                                    menus.push({
                                        path: currentPath,
                                        title: child.title
                                    });
                                }
                                
                                // 递归获取子菜单
                                if (child.children) {
                                    collectMenus(child, currentPath);
                                }
                            }
                        });
                    }
                    
                    // 从 admin 节点开始收集
                    if (menuTree.children.admin) {
                        collectMenus(menuTree.children.admin, '');
                    }
                    
                    // 也收集其他顶级节点（如 fwx_ 开头的菜单）
                    for (var name in menuTree.children) {
                        if (name !== 'admin' && menuTree.children[name]) {
                            collectMenus(menuTree.children[name], name);
                        }
                    }
                    
                    // 去重
                    var uniqueMenus = self.deduplicateMenus(menus);
                    
                    // 如果收集到的菜单太少，使用备用列表
                    if (uniqueMenus.length < 10) {
                        console.debug('Too few menus collected, using fallback');
                        resolve(self.getFallbackMenus());
                    } else {
                        resolve(uniqueMenus);
                    }
                    
                }).catch(function(err) {
                    console.debug('Menu load error:', err);
                    resolve(self.getFallbackMenus());
                });
                
            } catch (e) {
                console.debug('Error in loadAllMenus:', e);
                resolve(self.getFallbackMenus());
            }
        });
    },

    deduplicateMenus: function(menus) {
        var uniqueMenus = [];
        var seen = new Set();
        
        menus.forEach(function(menu) {
            if (menu && menu.path && !seen.has(menu.path)) {
                seen.add(menu.path);
                uniqueMenus.push(menu);
            }
        });
        
        // 按路径排序
        uniqueMenus.sort(function(a, b) {
            return (a.path || '').localeCompare(b.path || '');
        });
        
        return uniqueMenus;
    },

    getFallbackMenus: function() {
        return [
            { path: 'status/overview', title: 'Overview' },
            { path: 'status/processes', title: 'Processes' },
            { path: 'status/realtime', title: 'Realtime Graphs' },
            { path: 'status/iptables', title: 'Firewall Status' },
            { path: 'system/system', title: 'System' },
            { path: 'system/administration', title: 'Administration' },
            { path: 'system/startup', title: 'Startup' },
            { path: 'system/crontab', title: 'Scheduled Tasks' },
            { path: 'system/flash', title: 'Backup/Flash Firmware' },
            { path: 'system/ttyd', title: 'Terminal' },
            { path: 'system/advancedplus', title: 'Advanced Plus' },
            { path: 'system/ota', title: 'OTA Update' },
            { path: 'system/kucat-config', title: 'KuCat Config' },
            { path: 'system/partexp', title: 'Partition Exp' },
            { path: 'services/services', title: 'Services' },
            { path: 'services/AdGuardHome', title: 'AdGuard Home' },
            { path: 'network/interfaces', title: 'Interfaces' },
            { path: 'network/dhcp', title: 'DHCP and DNS' },
            { path: 'network/hostnames', title: 'Hostnames' },
            { path: 'network/routes', title: 'Static Routes' },
            { path: 'network/firewall', title: 'Firewall' },
            { path: 'network/diagnostics', title: 'Diagnostics' },
            { path: 'network/netspeedtest', title: 'Net Speed Test' },
            { path: 'control/eqosplus', title: 'EQoS Plus' },
            { path: 'control/timecontrol', title: 'Time Control' },
            { path: 'control/watchdog', title: 'Watchdog' },
            { path: 'control/taskplan', title: 'Task Plan' },
            { path: 'netwizard', title: 'Network Wizard' },
            { path: 'fwx_dashboard', title: 'Dashboard' },
            { path: 'fwx_network', title: 'Network' },
            { path: 'fwx_wireless', title: 'Wireless' },
            { path: 'fwx_parental_control', title: 'Parental Control' },
            { path: 'fwx_user', title: 'User Management' },
            { path: 'fwx_internet_record', title: 'Internet Record' },
            { path: 'fwx_advance', title: 'Advance Settings' },
            { path: 'docker/overview', title: 'Docker Overview' },
            { path: 'docker/containers', title: 'Docker Containers' },
            { path: 'docker/images', title: 'Docker Images' },
            { path: 'docker/networks', title: 'Docker Networks' },
            { path: 'vpn/tailscale', title: 'Tailscale VPN' },
            { path: 'vpn/openvpn', title: 'OpenVPN' },
            { path: 'vpn/wireguard', title: 'WireGuard' }
        ];
    },

    loadBasicMenus: function() {
        var self = this;
        
        // 先尝试通过RPC获取
        return this.callMenuConfig().then(function(result) {
            var basicSet = new Set();
            if (result && result.basic && Array.isArray(result.basic)) {
                result.basic.forEach(function(path) {
                    if (path) basicSet.add(path);
                });
            }
            
            // 如果RPC返回了数据，直接返回
            if (basicSet.size > 0) {
                return basicSet;
            }
            
            // 否则从文件读取
            return self.loadBasicMenusFromFile();
            
        }).catch(function() {
            // RPC失败，从文件读取
            return self.loadBasicMenusFromFile();
        });
    },

    loadBasicMenusFromFile: function() {
        return fs.read('/etc/config/kucat').then(function(content) {
            var basicSet = new Set();
            var lines = content.split('\n');
            var inBasicSection = false;
            
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                
                // 检查是否进入basic配置段
                if (line === 'config basic' || line === 'config basic \'settings\'') {
                    inBasicSection = true;
                    continue;
                }
                
                // 如果遇到其他config行，退出basic段
                if (inBasicSection && line.match(/^config /)) {
                    inBasicSection = false;
                }
                
                // 如果在basic段中，收集list item
                if (inBasicSection) {
                    var match = line.match(/list item ['"](.+)['"]/);
                    if (match && match[1]) {
                        basicSet.add(match[1]);
                    }
                }
            }
            
            return basicSet;
        }).catch(function() {
            // 文件不存在或读取失败，返回默认basic菜单
            return new Set([
                'status/overview',
                'status/realtime',
                'netwizard',
                'system/system',
                'system/admin',
                'system/ttyd',
                'system/advancedplus',
                'system/ota',
                'system/kucat-config',
                'services/AdGuardHome',
                'control/eqosplus',
                'control/timecontrol',
                'control/watchdog',
                'control/taskplan',
                'network/firewall',
                'network/netspeedtest',
                'system/partexp'
            ]);
        });
    },

    render: function(data) {
        var allMenus = data[0];
        var basicSet = data[1];
        
        // 分离basic和非basic菜单
        var basicMenus = [];
        var advancedMenus = [];
        
        allMenus.forEach(function(menu) {
            if (basicSet.has(menu.path)) {
                basicMenus.push(menu);
            } else {
                advancedMenus.push(menu);
            }
        });
        
        return E('div', { 'class': 'cbi-map', 'id': 'kucat-menu-config' }, [
            E('style', {}, [this.getStyles()]),
            E('h2', { 'class': 'cbi-page-title' }, [_('KuCat Menu Configuration')]),
            E('div', { 'class': 'cbi-section' }, [
                E('div', { 'class': 'cbi-section-descr' }, [
                    _('Configure the menu displayed in custom mode. Select items and use the buttons to switch between lists.')
                ]),
                
                E('div', { 'class': 'cbi-section-node' }, [
                    this.renderDualList(basicMenus, advancedMenus)
                ])
            ])
        ]);
    },

    getStyles: function() {
        return '' +
            '#kucat-menu-config .dual-list-container {' +
            '    display: flex;' +
            '    gap: 20px;' +
            '    margin: 20px 0;' +
            '    min-height: 500px;' +
            '}' +
            '#kucat-menu-config .list-box {' +
            '    flex: 1;' +
            '    border: 1px solid #ccc;' +
            '    border-radius: 4px;' +
            '    display: flex;' +
            '    flex-direction: column;' +
            '}' +
            '#kucat-menu-config .list-header {' +
            '    padding: 12px 15px;' +
            '    border-bottom: 1px solid #ccc;' +
            '    border-radius: 4px 4px 0 0;' +
            '    display: flex;' +
            '    justify-content: space-between;' +
            '    align-items: center;' +
            '}' +
            '#kucat-menu-config .list-header h3 {' +
            '    margin: 0;' +
            '    font-size: 16px;' +
            '    font-weight: 600;' +
            '}' +
            '#kucat-menu-config .list-count {' +
            '    font-size: 13px;' +
            '    color: #666;' +
            '    background: #e0e0e0;' +
            '    padding: 3px 8px;' +
            '    border-radius: 12px;' +
            '}' +
            '#kucat-menu-config .list-content {' +
            '    flex: 1;' +
            '    padding: 10px;' +
            '    overflow-y: auto;' +
            '    min-height: 400px;' +
            '    max-height: 500px;' +
            '}' +
            '#kucat-menu-config .list-footer {' +
            '    padding: 12px 15px;' +
            '    border-top: 1px solid #ccc;' +
            '    border-radius: 0 0 4px 4px;' +
            '    text-align: center;' +
            '}' +
            '#kucat-menu-config .list-controls {' +
            '    display: flex;' +
            '    flex-direction: column;' +
            '    justify-content: center;' +
            '    align-items: center;' +
            '}' +
            '#kucat-menu-config .list-controls .cbi-button {' +
            '    width: 110px;' +
            '    margin: 5px 0;' +
            '}' +
            '#kucat-menu-config .menu-list-item {' +
            '    margin: 2px 0;' +
            '    padding: 8px 4px 8px 4px;' +
            '    border-radius: 3px;' +
            '    transition: background 0.2s ease;' +
            '}' +
            '#kucat-menu-config .menu-list-item:hover {' +
            '    background: rgba(255,255,255,0.1);' +
            '}' +
            '#kucat-menu-config .menu-item-label {' +
            '    display: flex;' +
            '    align-items: center;' +
            '    cursor: pointer;' +
            '    width: 100%;' +
            '}' +
            '#kucat-menu-config .menu-item-label .menu-checkbox {' +
            '    margin-right: 10px;' +
            '}' +
            '#kucat-menu-config .menu-item-label .menu-title {' +
            '    font-size: 14px;' +
            '    font-weight: 500;' +
            '    flex: 1;' +
            '}' +
            '#kucat-menu-config .menu-item-label .menu-path {' +
            '    font-size: 11px;' +
            '    margin-left: 10px;' +
            '    font-family: monospace;' +
            '}' +
            '#kucat-menu-config .button-group {' +
            '    display: flex;' +
            '    justify-content: flex-start;' +
            '    align-items: center;' +
            '    gap: 10px;' +
            '}' +
            '#kucat-menu-config .cbi-button-add,' +
            '#kucat-menu-config .cbi-button-remove {' +
            '    padding: 8px 16px;' +
            '    border: none;' +
            '    border-radius: 4px;' +
            '    font-size: 14px;' +
            '    cursor: pointer;' +
            '    transition: all 0.2s ease;' +
            '}' +
            '#kucat-menu-config .cbi-button-add {' +
            '    background: #4CAF50;' +
            '    color: white;' +
            '}' +
            '#kucat-menu-config .cbi-button-add:hover:not(:disabled) {' +
            '    background: #45a049;' +
            '}' +
            '#kucat-menu-config .cbi-button-remove {' +
            '    background: #f44336;' +
            '    color: white;' +
            '}' +
            '#kucat-menu-config .cbi-button-remove:hover:not(:disabled) {' +
            '    background: #da190b;' +
            '}' +
            '#kucat-menu-config .cbi-button:disabled {' +
            '    opacity: 0.5;' +
            '    cursor: not-allowed;' +
            '}' +
            '@media screen and (max-width: 920px) {' +
            '    #kucat-menu-config .dual-list-container {' +
            '        flex-direction: column;' +
            '    }' +
            '    #kucat-menu-config .list-controls {' +
            '        width: 100%;' +
            '        flex-direction: row;' +
            '        justify-content: center;' +
            '    }' +
            '    #kucat-menu-config .list-controls .cbi-button {' +
            '        width: auto;' +
            '        margin: 0 10px;' +
            '    }' +
            '}';
    },

    renderDualList: function(basicMenus, advancedMenus) {
        var self = this;
        
        // 按主分类排序
        basicMenus.sort(self.sortByMainCategory.bind(self));
        advancedMenus.sort(self.sortByMainCategory.bind(self));
        
        var basicListContent = E('div', { 'class': 'list-content', 'id': 'basic-list-content' });
        var advancedListContent = E('div', { 'class': 'list-content', 'id': 'advanced-list-content' });
        
        // 渲染basic菜单列表
        basicMenus.forEach(function(menu, index) {
            basicListContent.appendChild(self.renderMenuItem(menu, 'basic', index));
        });
        
        // 渲染advanced菜单列表
        advancedMenus.forEach(function(menu, index) {
            advancedListContent.appendChild(self.renderMenuItem(menu, 'advanced', index));
        });
        
        return E('div', { 'class': 'dual-list-container' }, [
            E('div', { 'class': 'list-box basic-list' }, [
                E('div', { 'class': 'list-header' }, [
                    E('h3', {}, [_('Custom Menu')]),
                    E('span', { 'class': 'list-count' }, [basicMenus.length + ' ' + _('items')])
                ]),
                basicListContent,
                E('div', { 'class': 'list-footer' }, [
                    E('button', {
                        'class': 'cbi-button cbi-button-remove',
                        'click': ui.createHandlerFn(self, 'handleRemoveSelected'),
                        'disabled': basicMenus.length === 0 ? 'disabled' : null
                    }, [_('Remove') + ' →'])
                ])
            ]),
            
            E('div', { 'class': 'list-controls' }, [
                E('button', {
                    'class': 'cbi-button cbi-button-add',
                    'click': ui.createHandlerFn(self, 'handleAddSelected'),
                    'disabled': advancedMenus.length === 0 ? 'disabled' : null
                }, ['← ' + _('Add')]),
                E('button', {
                    'class': 'cbi-button cbi-button-remove',
                    'click': ui.createHandlerFn(self, 'handleRemoveSelected'),
                    'disabled': basicMenus.length === 0 ? 'disabled' : null,
                    'style': 'margin-top: 10px;'
                }, [_('Remove') + ' →'])
            ]),
            
            E('div', { 'class': 'list-box advanced-list' }, [
                E('div', { 'class': 'list-header' }, [
                    E('h3', {}, [_('Full Menus')]),
                    E('span', { 'class': 'list-count' }, [advancedMenus.length + ' ' + _('items')])
                ]),
                advancedListContent,
                E('div', { 'class': 'list-footer' }, [
                    E('button', {
                        'class': 'cbi-button cbi-button-add',
                        'click': ui.createHandlerFn(self, 'handleAddSelected'),
                        'disabled': advancedMenus.length === 0 ? 'disabled' : null
                    }, ['← ' + _('Add')])
                ])
            ])
        ]);
    },

    renderMenuItem: function(menu, type, index) {
        var self = this;
        var checkbox = E('input', {
            'type': 'checkbox',
            'class': 'menu-checkbox',
            'data-path': menu.path,
            'data-title': menu.title,
            'data-list': type,
            'value': menu.path,
            'id': 'menu-' + type + '-' + index
        });
        
        checkbox.addEventListener('change', function() {
            self.handleCheckboxChange();
        });
        
        var label = E('label', {
            'class': 'menu-item-label',
            'for': 'menu-' + type + '-' + index
        }, [
            checkbox,
            E('span', { 'class': 'menu-title' }, [menu.title]),
            E('span', { 'class': 'menu-path' }, ['(' + menu.path + ')'])
        ]);
        
        return E('div', { 'class': 'menu-list-item' }, [label]);
    },

    /**
     * 按主分类排序
     */
    sortByMainCategory: function(a, b) {
        // 获取主分类（路径的第一部分）
        var getMainCategory = function(path) {
            if (!path) return '';
            var parts = path.split('/');
            return parts[0] || '';
        };
        
        var categoryA = getMainCategory(a.path);
        var categoryB = getMainCategory(b.path);
        
        // 先按主分类排序
        var categoryCompare = categoryA.localeCompare(categoryB);
        if (categoryCompare !== 0) {
            return categoryCompare;
        }
        
        // 如果主分类相同，再按完整路径排序
        return (a.path || '').localeCompare(b.path || '');
    },

    getSelectedItems: function(listId) {
        var container = document.getElementById(listId);
        if (!container) return [];
        
        var checkboxes = container.querySelectorAll('.menu-checkbox:checked');
        var selected = [];
        
        checkboxes.forEach(function(cb) {
            selected.push({
                path: cb.getAttribute('data-path'),
                title: cb.getAttribute('data-title')
            });
        });
        
        return selected;
    },

    handleAddSelected: function() {
        var self = this;
        var selected = this.getSelectedItems('advanced-list-content');
        
        if (selected.length === 0) {
            alert(_('No items selected'));
            return;
        }
        
        var basicContainer = document.getElementById('basic-list-content');
        var advancedContainer = document.getElementById('advanced-list-content');
        
        if (!basicContainer || !advancedContainer) return;
        
        // 获取当前所有菜单
        var basicItems = [];
        var advancedItems = [];
        
        basicContainer.querySelectorAll('.menu-checkbox').forEach(function(cb) {
            basicItems.push({
                path: cb.getAttribute('data-path'),
                title: cb.getAttribute('data-title')
            });
        });
        
        advancedContainer.querySelectorAll('.menu-checkbox').forEach(function(cb) {
            var path = cb.getAttribute('data-path');
            var isSelected = selected.some(function(item) {
                return item.path === path;
            });
            if (!isSelected) {
                advancedItems.push({
                    path: path,
                    title: cb.getAttribute('data-title')
                });
            }
        });
        
        // 添加选中的到basic
        selected.forEach(function(item) {
            basicItems.push(item);
        });
        
        // 按主分类排序
        basicItems.sort(self.sortByMainCategory.bind(self));
        advancedItems.sort(self.sortByMainCategory.bind(self));
        
        // 重新渲染
        basicContainer.innerHTML = '';
        advancedContainer.innerHTML = '';
        
        basicItems.forEach(function(menu, index) {
            basicContainer.appendChild(self.renderMenuItem(menu, 'basic', index));
        });
        
        advancedItems.forEach(function(menu, index) {
            advancedContainer.appendChild(self.renderMenuItem(menu, 'advanced', index));
        });
        
        this.updateCounts();
        
        //alert(selected.length + ' ' + _('items moved to Basic mode'));
    },

    handleRemoveSelected: function() {
        var self = this;
        var selected = this.getSelectedItems('basic-list-content');
        
        if (selected.length === 0) {
            //alert(_('No items selected'));
            return;
        }
        
        var basicContainer = document.getElementById('basic-list-content');
        var advancedContainer = document.getElementById('advanced-list-content');
        
        if (!basicContainer || !advancedContainer) return;
        
        // 获取当前所有菜单
        var basicItems = [];
        var advancedItems = [];
        
        advancedContainer.querySelectorAll('.menu-checkbox').forEach(function(cb) {
            advancedItems.push({
                path: cb.getAttribute('data-path'),
                title: cb.getAttribute('data-title')
            });
        });
        
        basicContainer.querySelectorAll('.menu-checkbox').forEach(function(cb) {
            var path = cb.getAttribute('data-path');
            var isSelected = selected.some(function(item) {
                return item.path === path;
            });
            if (!isSelected) {
                basicItems.push({
                    path: path,
                    title: cb.getAttribute('data-title')
                });
            }
        });
        
        // 添加选中的到advanced
        selected.forEach(function(item) {
            advancedItems.push(item);
        });
        
        // 按主分类排序
        basicItems.sort(self.sortByMainCategory.bind(self));
        advancedItems.sort(self.sortByMainCategory.bind(self));
        
        // 重新渲染
        basicContainer.innerHTML = '';
        advancedContainer.innerHTML = '';
        
        basicItems.forEach(function(menu, index) {
            basicContainer.appendChild(self.renderMenuItem(menu, 'basic', index));
        });
        
        advancedItems.forEach(function(menu, index) {
            advancedContainer.appendChild(self.renderMenuItem(menu, 'advanced', index));
        });
        
        this.updateCounts();
        
        //alert(selected.length + ' ' + _('items removed from Basic mode'));
    },

    updateCounts: function() {
        var basicContainer = document.getElementById('basic-list-content');
        var advancedContainer = document.getElementById('advanced-list-content');
        
        if (basicContainer) {
            var basicCount = basicContainer.querySelectorAll('.menu-checkbox').length;
            var basicHeader = document.querySelector('.basic-list .list-count');
            if (basicHeader) {
                basicHeader.textContent = basicCount + ' ' + _('items');
            }
        }
        
        if (advancedContainer) {
            var advancedCount = advancedContainer.querySelectorAll('.menu-checkbox').length;
            var advancedHeader = document.querySelector('.advanced-list .list-count');
            if (advancedHeader) {
                advancedHeader.textContent = advancedCount + ' ' + _('items');
            }
        }
        
        this.updateButtonStates();
    },

    handleSave: function() {
        var self = this;
        var basicContainer = document.getElementById('basic-list-content');
        if (!basicContainer) return;
        
        var basicCheckboxes = basicContainer.querySelectorAll('.menu-checkbox');
        var selected = [];
        
        basicCheckboxes.forEach(function(cb) {
            var path = cb.getAttribute('data-path');
            if (path) {
                selected.push(path);
            }
        });
        
        // console.log('Saving basic menus:', selected);
        
        // 先读取现有配置文件
        fs.read('/etc/config/kucat').then(function(content) {
            var lines = content.split('\n');
            var newContent = [];
            var inBasicSection = false;
            var basicSectionUpdated = false;
            
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var trimmedLine = line.trim();
                
                // 检查是否进入basic配置段
                if (trimmedLine === 'config basic' || trimmedLine === 'config basic \'settings\'') {
                    inBasicSection = true;
                    newContent.push(line);
                    basicSectionUpdated = true;
                    continue;
                }
                
                // 如果遇到其他config行，退出basic段
                if (inBasicSection && trimmedLine.match(/^config /)) {
                    inBasicSection = false;
                }
                
                // 如果在basic段中，跳过原有的list item行
                if (inBasicSection && trimmedLine.match(/^list item/)) {
                    continue;
                }
                
                // 添加其他行
                newContent.push(line);
            }
            
            // 如果找到了basic段，在段内添加新的list items
            if (basicSectionUpdated) {
                var result = [];
                for (var i = 0; i < newContent.length; i++) {
                    result.push(newContent[i]);
                    // 如果是basic段的开始行，在后面添加list items
                    if (newContent[i].trim() === 'config basic' || newContent[i].trim() === 'config basic \'settings\'') {
                        selected.forEach(function(path) {
                            result.push('    list item \'' + path + '\'');
                        });
                    }
                }
                newContent = result;
            } else {
                // 如果文件中没有basic配置段，添加一个
                newContent.push('');
                newContent.push('config basic \'settings\'');
                selected.forEach(function(path) {
                    newContent.push('    list item \'' + path + '\'');
                });
            }
            
            // 写入更新后的配置
            return fs.write('/etc/config/kucat', newContent.join('\n'));
            
        }).then(function() {
            // alert(_('Configuration saved successfully'));
            // 重新加载页面以显示更新后的列表
            window.location.reload();
        }).catch(function(err) {
            // console.error('Save error:', err);
            // alert(_('Failed to save configuration: ' + (err.message || 'Unknown error')));
        });
    },

    handleReset: function() {
        window.location.reload();
    },

    handleCheckboxChange: function() {
        this.updateButtonStates();
    },

    updateButtonStates: function() {
        var basicContainer = document.getElementById('basic-list-content');
        var advancedContainer = document.getElementById('advanced-list-content');
        
        if (!basicContainer || !advancedContainer) return;
        
        var basicCheckboxes = basicContainer.querySelectorAll('.menu-checkbox');
        var advancedCheckboxes = advancedContainer.querySelectorAll('.menu-checkbox');
        
        var hasBasicSelected = Array.from(basicCheckboxes).some(function(cb) {
            return cb.checked;
        });
        var hasAdvancedSelected = Array.from(advancedCheckboxes).some(function(cb) {
            return cb.checked;
        });
        
        var removeButtons = document.querySelectorAll('#kucat-menu-config .cbi-button-remove');
        removeButtons.forEach(function(btn) {
            btn.disabled = !hasBasicSelected;
        });
        
        var addButtons = document.querySelectorAll('#kucat-menu-config .cbi-button-add');
        addButtons.forEach(function(btn) {
            btn.disabled = !hasAdvancedSelected;
        });
    }
});
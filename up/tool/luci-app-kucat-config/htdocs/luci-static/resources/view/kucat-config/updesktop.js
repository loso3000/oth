'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require view';

var callAvailSpace = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'avail',
    expect: { avail: 0 }
});

var callRemovekucat = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'remove',
    params: ['filename'],
    expect: { result: 0 }
});

var callRenamekucat = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'rename',
    params: ['newname'],
    expect: { result: 0 }
});

var callUploadFile = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'upload',
    params: ['filename', 'filedata'],
    expect: { result: 0 }
});

var callSetPermissions = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'set_permissions',
    params: ['filename'],
    expect: { result: 0 }
});

var callFileList = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'file_list',
    expect: { files: [] }
});

var bg_path = '/www/luci-static/kucat/background/';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('kucat'),
            L.resolveDefault(callAvailSpace(), { avail: 0 }),
            L.resolveDefault(callFileList(), { files: [] })
        ]);
    },

    render: function(data) {
        var m, s, o;
        var avail_space = data[1].avail || 0;
        var file_list = data[2].files || [];

        m = new form.Map('kucat', _('KuCat theme configuration'),
            _('Here you can set the blur and transparency of the login page of kucat theme, and manage the background pictures and videos. Chrome is recommended.'));

        // 主题配置部分
        s = m.section(form.TypedSection, 'global', _('Theme configuration'));
        s.addremove = false;
        s.anonymous = true;

        // 上传背景部分
        s = m.section(form.TypedSection, null, 
            _('Upload background (available space: %1024.2mB)').format(avail_space),
            _('You can upload files such as gif/jpg/mp4/png/webm/webp files, to change the login page background. Maximum file size: 50MB.'));
        s.addremove = false;
        s.anonymous = true;

        // 上传按钮
        o = s.option(form.Button, '_upload_bg', _('Upload background'),
            _('Files will be uploaded to <code>%s</code>. Supported formats: JPG, PNG, GIF, WebP, MP4, WebM').format(bg_path));
        o.inputstyle = 'action';
        o.inputtitle = _('Upload...');
        o.onclick = L.bind(this.handleUpload, this);
        o.modalonly = false;

        // 文件列表部分
        s = m.section(form.TableSection, 'filelist', _('Background file list'));
        s.render = L.bind(this.renderFileList, this, file_list);

        return m.render();
    },

    handleUpload: function(ev, section_id) {
        var self = this;
        
        return ui.showFileUpload(null, ev.target).then(function(files) {
            if (!files || files.length === 0) {
                return Promise.reject(new Error(_('No file selected')));
            }

            var file = files[0];
            var temp_path = '/tmp/kucat_upload_' + Date.now() + '_' + file.name;
            
            return fs.write(temp_path, file.content).then(function() {
                // 调用后端处理文件
                return L.resolveDefault(callRenamekucat(file.name), {});
            }).then(function(res) {
                if (res && res.result === 0) {
                    ui.addNotification(null, E('p', _('File uploaded successfully: %s').format(file.name)));
                    return location.reload();
                } else {
                    throw new Error(_('Failed to upload file: %s').format(file.name));
                }
            }).catch(function(err) {
                // 清理临时文件
                return fs.remove(temp_path).catch(function() {}).finally(function() {
                    throw err;
                });
            });
        }).catch(function(err) {
            ui.addNotification(null, E('p', _('Upload failed: %s').format(err.message)));
        });
    },

    renderFileList: function(file_list) {
        var files = Array.isArray(file_list) ? file_list : [];
        
        if (files.length === 0) {
            return E('div', { 'class': 'cbi-section' }, [
                E('p', { 'class': 'cbi-section-description' }, _('No background files found.'))
            ]);
        }

        var table = E('table', { 
            'class': 'table cbi-section-table',
            'style': 'width: 100%;'
        }, [
            E('tr', { 'class': 'tr table-titles' }, [
                E('th', { 'class': 'th', 'style': 'width: 40%;' }, _('Filename')),
                E('th', { 'class': 'th', 'style': 'width: 25%;' }, _('Modified date')),
                E('th', { 'class': 'th', 'style': 'width: 15%;' }, _('Size')),
                E('th', { 'class': 'th', 'style': 'width: 20%;' }, _('Action'))
            ])
        ]);

        // 按修改时间排序，最新的在前面
        files.sort(function(a, b) {
            return (b.mtime || 0) - (a.mtime || 0);
        });

        files.forEach(L.bind(function(file) {
            var row = E('tr', { 'class': 'tr' }, [
                E('td', { 'class': 'td' }, [
                    E('code', file.name)
                ]),
                E('td', { 'class': 'td' }, 
                    file.mtime ? new Date(file.mtime * 1000).toLocaleString() : _('Unknown')
                ),
                E('td', { 'class': 'td' }, 
                    file.size ? String.format('%1024.2mB', file.size) : _('Unknown')
                ),
                E('td', { 'class': 'td' }, [
                    E('button', {
                        'class': 'btn cbi-button cbi-button-remove',
                        'click': ui.createHandlerFn(this, this.handleDeleteFile, file.name)
                    }, _('Delete'))
                ])
            ]);

            table.appendChild(row);
        }, this));

        return E('div', { 'class': 'cbi-section' }, table);
    },

    handleDeleteFile: function(filename) {
        return ui.showModal(_('Confirm deletion'), [
            E('p', _('Are you sure you want to delete the file "%s"?').format(filename)),
            E('div', { 'class': 'right' }, [
                E('button', {
                    'class': 'btn cbi-button cbi-button-negative',
                    'click': ui.createHandlerFn(this, function() {
                        return L.resolveDefault(callRemovekucat(filename), {})
                            .then(function(res) {
                                if (res && res.result === 0) {
                                    ui.addNotification(null, E('p', _('File deleted successfully: %s').format(filename)));
                                    return location.reload();
                                } else {
                                    throw new Error(_('Failed to delete file: %s').format(filename));
                                }
                            })
                            .catch(function(err) {
                                ui.addNotification(null, E('p', err.message));
                            });
                    })
                }, _('Delete')),
                ' ',
                E('button', {
                    'class': 'btn cbi-button cbi-button-link',
                    'click': ui.hideModal
                }, _('Cancel'))
            ])
        ]);
    }
});

'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require view';

var callAvailSpace = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'availd'
});

var callRemovekucat = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'removed',
    params: ['filename'],
    expect: { '': {} }
});

var callRenamekucat = rpc.declare({
    object: 'luci.kucatconfig',
    method: 'renamed',
    params: ['newname'],
    expect: { '': {} }
});

var bg_path = '/www/luci-static/kucat/background/';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('kucat'),
            L.resolveDefault(callAvailSpace(), {}),
            L.resolveDefault(fs.list(bg_path), {})
        ]);
    },

    render: function(data) {
        var m, s, o;

        m = new form.Map('kucat', _('Kucat Desktop Background Configuration'),
            _('Here you can upload and manage background images for the kucat theme desktop page.'));

        // 上传区域 - 只有一个
        s = m.section(form.TypedSection, null, _('Upload Desktop Background (available space: %1024.2mB)')
            .format(data[1].avail * 1024),
            _('You can upload files such as gif/jpg/mp4/png/webm/webp files, to change the desktop background.'));
        s.addremove = false;
        s.anonymous = true;

        o = s.option(form.Button, '_upload_bg', _('Upload Desktop Background'),
            _('Files will be uploaded to <code>%s</code>.').format(bg_path));
        o.inputstyle = 'action';
        o.inputtitle = _('Upload...');
        o.onclick = function(ev, section_id) {
            var file = '/tmp/kucat_desktop_bg.tmp';
            return ui.uploadFile(file, ev.target).then(function(res) {
                return L.resolveDefault(callRenamekucat(res.name), {}).then(function(ret) {
                    if (ret.result === 0)
                        return location.reload();
                    else {
                        ui.addNotification(null, E('p', _('Failed to upload file: %s.').format(res.name)));
                        return L.resolveDefault(fs.remove(file), {});
                    }
                });
            })
            .catch(function(e) { ui.addNotification(null, E('p', e.message)); });
        };

        // 文件列表 - 使用自定义渲染避免重复
        var fileListDiv = E('div', { 'class': 'cbi-section' }, [
            E('h3', _('Desktop Background Files')),
            E('table', { 'class': 'table cbi-section-table' }, [
                E('tr', { 'class': 'tr table-titles' }, [
                    E('th', { 'class': 'th' }, [ _('Filename') ]),
                    E('th', { 'class': 'th' }, [ _('Modified date') ]),
                    E('th', { 'class': 'th' }, [ _('Size') ]),
                    E('th', { 'class': 'th' }, [ _('Action') ])
                ])
            ])
        ]);

        var fileTable = fileListDiv.lastChild;
        var files = data[2] || [];

        if (files.length > 0) {
            files.forEach(function(file) {
                var row = E('tr', { 'class': 'tr' }, [
                    E('td', { 'class': 'td' }, [ file.name ]),
                    E('td', { 'class': 'td' }, [ new Date(file.mtime * 1000).toLocaleString() ]),
                    E('td', { 'class': 'td' }, [ String.format('%1024.2mB', file.size) ]),
                    E('td', { 'class': 'td' }, [
                        E('button', {
                            'class': 'btn cbi-button cbi-button-remove',
                            'click': ui.createHandlerFn(this, function() {
                                return L.resolveDefault(callRemovekucat(file.name), {})
                                .then(function() { return location.reload(); });
                            })
                        }, [ _('Delete') ])
                    ])
                ]);
                fileTable.appendChild(row);
            });
        } else {
            var row = E('tr', { 'class': 'tr' }, [
                E('td', { 'class': 'td', 'colspan': '4' }, [ E('em', _('No files found.')) ])
            ]);
            fileTable.appendChild(row);
        }

        return E([], [
            m.render(),
            E('hr'),
            fileListDiv
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
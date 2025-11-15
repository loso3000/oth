'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require view';

var callAvailSpace = rpc.declare({
	object: 'luci.kucatconfig',
	method: 'avail'
});

var callRemovekucat = rpc.declare({
	object: 'luci.kucatconfig',
	method: 'remove',
	params: ['filename'],
	expect: { '': {} }
});

var callRenamekucat = rpc.declare({
	object: 'luci.kucatconfig',
	method: 'rename',
	params: ['newname'],
	expect: { '': {} }
});

var bg_path = '/www/luci-static/kucat/background/';

var opacity_sets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20];
var ts_sets =  [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1];

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
		m = new form.Map('kucat', _('KuCat Theme Config'),
			_('Here you can set the blur and transparency of the login page of kucat theme, and manage the background pictures.'));
		s = m.section(form.TypedSection, 'basic', _('Settings'));
		s.anonymous = true;

		// Wallpaper Source
		o = s.option(form.ListValue, 'background', _('Wallpaper Source'), 
			_('Local wallpapers need to be uploaded on their own, and only the first update downloaded on the same day will be automatically downloaded.'));
		o.value('0', _('Local wallpaper'));
		o.value('1', _('Auto download Iciba wallpaper'));
		o.value('2', _('Auto download unsplash wallpaper'));
		o.value('3', _('Auto download Bing wallpaper'));
		o.value('4', _('Auto download Bird 4K wallpaper'));
		o.default = '0';
		o.rmempty = false;
		
		// Set font size
		o = s.option(form.ListValue, 'fontmode', _('Set font size'));
		o.rmempty = false;
		o.value('0', _('Small font'));
		o.value('1', _('Normal font'));
		o.value('2', _('Large font'));
		o.default = '0';

		// Wallpaper synchronization
		o = s.option(form.Flag, 'bklock', _('Wallpaper synchronization'),
			_('Is the login wallpaper consistent with the desktop wallpaper? If not selected, it indicates that the desktop wallpaper and login wallpaper are set independently.'));
		o.rmempty = false;
		o.default = '0';

		// Expand Toolbar
		o = s.option(form.Flag, 'setbar', _('Expand Toolbar'),
			_('Expand or shrink the toolbar'));
		o.rmempty = false;
		o.default = '0';

		// Refreshing mode
		o = s.option(form.Flag, 'bgqs', _('Refreshing mode'));
		o.rmempty = false;
		o.default = '0';

		// Enable Daily Word
		o = s.option(form.Flag, 'dayword', _('Enable Daily Word'));
		o.rmempty = false;
		o.default = '0';

		// Status Homekey settings
		o = s.option(form.ListValue, 'gohome', _('Status Homekey settings'));
		o.value('overview', _('Overview'));
		o.value('online', _('Online User'));
		o.value('realtime', _('Realtime Graphs'));
		o.value('netdata', _('NetData'));
		o.default = 'overview';
		o.rmempty = false;

		// System Userkey settings
		o = s.option(form.ListValue, 'gouser', _('System Userkey settings'));
		o.value('kucat-config', _('Advanced plus'));
		o.value('netwizard', _('Inital Setup'));
		o.value('system', _('System'));
		o.value('admin', _('Administration'));
		o.value('terminal', _('TTYD Terminal'));
		o.value('packages', _('Software'));
		o.value('filetransfer', _('FileTransfer'));
		o.default = 'kucat';
		o.rmempty = false;

		// Services Ssrkey settings
		o = s.option(form.ListValue, 'gossr', _('Services Ssrkey settings'));
		o.value('shadowsocksr', _('SSR'));
		o.value('bypass', _('bypass'));
		o.value('nikki', _('nikki[Mihomo]'));
		o.value('passwall', _('passwall'));
		o.value('passwall2', _('passwall2'));
		o.value('openclash', _('OpenClash'));
		o.value('homeproxy', _('HomeProxy'));
		o.value('vssr', _('Hello World'));
		o.default = 'bypass';
		o.rmempty = false;

		o = s.option(form.Button, '_save', _('Save settings'));
		o.inputstyle = 'apply';
		o.inputtitle = _('Save current settings');
		o.onclick = function() {
			ui.changes.apply(true);
			return this.map.save(null, true);
		}

		// Add theme scheme section reference
		s = m.section(form.GridSection, 'theme', _('Color Schemes'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'remarks', _('Remarks'),
			_('Give a descriptive name for this color scheme'));

		o = s.option(form.Flag, 'use', _('Enable color matching'),
			_('Enable this color scheme'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'mode', _('Theme mode'),
			_('Select the theme appearance mode'));
		o.value('auto', _('Auto'));
		o.value('light', _('Light'));
		o.value('dark', _('Dark'));
		o.default = 'light';

		o = s.option(form.Value, 'primary_rgbm', _('Main Background color(RGB)'),
			_('RGB values like "255,0,0" for red, or use preset names'));
		o.value('blue', _('RoyalBlue'));
		o.value('green', _('MediumSeaGreen'));
		o.value('orange', _('SandyBrown'));
		o.value('red', _('TomatoRed'));
		o.value('black', _('Black tea eye protection gray'));
		o.value('gray', _('Cool night time(gray and dark)'));
		o.value('bluets', _('Cool Ocean Heart (transparent and bright)'));
		o.rmempty = false;
		o.default = '74,161,133';

		o = s.option(form.Flag, 'bkuse', _('Enable wallpaper'),
			_('Show background wallpaper'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'primary_rgbm_ts', _('Wallpaper transparency'),
			_('Set the transparency level of the wallpaper'));
		ts_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.rmempty = false;
		o.default = '0.5';

		o = s.option(form.ListValue, 'primary_opacity', _('Wallpaper blur radius'),
			_('Blur effect on wallpaper (0 = no blur)'));
		opacity_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0';

		o = s.option(form.Value, 'primary_rgbs', _('Fence background(RGB)'),
			_('Background color for sections and partitions'));
		o.default = '225,112,88';
		o.rmempty = false;
		
		o = s.option(form.ListValue, 'primary_rgbs_ts', _('Fence background transparency'),
			_('Transparency level for partition backgrounds'));
		ts_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0.1';

		s = m.section(form.TypedSection, null, _('Upload background (available space: %1024.2mB)')
			.format(data[1].avail * 1024),
			_('You can upload files such as gif/jpg/mp4/png/webm/webp files, to change the login page background.'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Button, '_upload_bg', _('Upload background'),
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
		o.modalonly = true;

		s = m.section(form.TableSection);
		s.render = function() {
			var tbl = E('table', { 'class': 'table cbi-section-table' },
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, [ _('Filename') ]),
					E('th', { 'class': 'th' }, [ _('Modified date') ]),
					E('th', { 'class': 'th' }, [ _('Size') ]),
					E('th', { 'class': 'th' }, [ _('Action') ])
				])
			);

			cbi_update_table(tbl, data[2].map(L.bind(function(file) {
				return [
					file.name,
					new Date(file.mtime * 1000).toLocaleString(),
					String.format('%1024.2mB', file.size),
					E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': ui.createHandlerFn(this, function() {
							return L.resolveDefault(callRemovekucat(file.name), {})
							.then(function() { return location.reload(); });
						})
					}, [ _('Delete') ])
				];
			}, this)), E('em', _('No files found.')));

			return E('div', { 'class': 'cbi-map', 'id': 'cbi-filelist' }, [
				E('h3', _('Background file list')),
				tbl
			]);
		};

		return m.render();
	}
});
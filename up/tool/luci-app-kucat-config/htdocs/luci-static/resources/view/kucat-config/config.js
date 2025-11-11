'use strict';
'require baseclass';
'require form';
'require uci';
'require fs';
'require rpc';

return baseclass.extend({
	title: _('KuCat Theme Config'),
	description: _('Set and manage features such as KuCat themed background wallpaper, main background color, partition background, transparency, blur, toolbar retraction and shortcut pointing.</br>') +
		_('There are 6 preset color schemes, and only the desktop background image can be set to display or not. The custom color values are RGB values such as 255,0,0 (representing red), and a blur radius of 0 indicates no lag in the image.') +
		_('</br>For specific usage, see:') + _('<a href="https://github.com/sirpdboy/luci-app-kucat-config.git" target="_blank">GitHub @sirpdboy/luci-app-kucat-config </a>'),

	opacity_sets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20],
	ts_sets: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1],

	load: function() {
		return Promise.all([
			uci.load('kucat')
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('kucat', _('KuCat Theme Config'), this.description);

		// Basic settings section
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

		// Set font size
		o = s.option(form.ListValue, 'fontmode', _('Set font size'));
		o.rmempty = false;
		o.value('0', _('Small font'));
		o.value('1', _('Normal font'));
		o.value('2', _('Large font'));
		o.default = '1';

		// RGB Palette Tools - DummyValue
		o = s.option(form.DummyValue, '_color_tools', _('RGB Palette Tools'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div id="color-palette-tools"></div>';
		};

		// Add theme scheme section reference
		s = m.section(form.GridSection, 'theme', _('Color scheme list'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));

		o = s.option(form.Flag, 'use', _('Enable color matching'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'mode', _('Theme mode'));
		o.value('auto', _('Auto'));
		o.value('light', _('Light'));
		o.value('dark', _('Dark'));
		o.default = 'light';

		o = s.option(form.Value, 'primary_rgbm', _('Main Background color(RGB)'));
		o.value('blue', _('RoyalBlue'));
		o.value('green', _('MediumSeaGreen'));
		o.value('orange', _('SandyBrown'));
		o.value('red', _('TomatoRed'));
		o.value('black', _('Black tea eye protection gray'));
		o.value('gray', _('Cool night time(gray and dark)'));
		o.value('bluets', _('Cool Ocean Heart (transparent and bright)'));
		o.default = 'green';
		o.datatype = 'ufloat';
		o.default = '74,161,133';

		o = s.option(form.Flag, 'bkuse', _('Enable wallpaper'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'primary_rgbm_ts', _('Wallpaper transparency'));
		this.ts_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0.5';

		o = s.option(form.ListValue, 'primary_opacity', _('Wallpaper blur radius'));
		this.opacity_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '10';

		o = s.option(form.Value, 'primary_rgbs', _('Fence background(RGB)'));
		o.default = '225,112,88';
		o.datatype = 'ufloat';

		o = s.option(form.ListValue, 'primary_rgbs_ts', _('Fence background transparency'));
		this.ts_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0.3';

		// Apply settings
		m.applyOnParse = true;
		m.onApply = function() {
			return Promise.resolve().then(function() {
				return L.resolveDefault(fs.exec('/etc/init.d/kucat', ['start']), '');
			}).then(function() {
				window.location.href = L.url('admin/system/kucat/kucatset');
			});
		};

		return m.render();
	}
});

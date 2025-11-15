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
		
		s = m.section(form.TypedSection, 'basic', '');
		s.anonymous = true;
		
		s.tab('basic',  _('Basic Settings'));
		s.tab('theme', _('Color Schemes'));

		// Wallpaper Source
		o = s.taboption('basic', form.ListValue, 'background', _('Wallpaper Source'), 
			_('Local wallpapers need to be uploaded on their own, and only the first update downloaded on the same day will be automatically downloaded.'));
		o.value('0', _('Local wallpaper'));
		o.value('1', _('Auto download Iciba wallpaper'));
		o.value('2', _('Auto download unsplash wallpaper'));
		o.value('3', _('Auto download Bing wallpaper'));
		o.value('4', _('Auto download Bird 4K wallpaper'));
		o.default = '0';
		o.rmempty = false;
		
		// Set font size
		o = s.taboption('basic', form.ListValue, 'fontmode', _('Set font size'));
		o.rmempty = false;
		o.value('0', _('Small font'));
		o.value('1', _('Normal font'));
		o.value('2', _('Large font'));
		o.default = '0';

		// Wallpaper synchronization
		o = s.taboption('basic', form.Flag, 'bklock', _('Wallpaper synchronization'),
			_('Is the login wallpaper consistent with the desktop wallpaper? If selected, it means that the desktop wallpaper and login wallpaper are the same image.'));
		o.rmempty = false;
		o.default = '0';

		// Expand Toolbar
		o = s.taboption('basic', form.Flag, 'setbar', _('Expand navigation bar'),
			_('Expand or shrink the five quick navigation bars'));
		o.rmempty = false;
		o.default = '0';

		// Refreshing mode
		o = s.taboption('basic', form.Flag, 'bgqs', _('Refreshing mode'));
		o.rmempty = false;
		o.default = '0';

		// Enable Daily Word
		o = s.taboption('basic', form.Flag, 'dayword', _('Enable Daily Word'));
		o.rmempty = false;
		o.default = '0';

		// Status Homekey settings
		o = s.taboption('basic', form.ListValue, 'gohome', _('Status Homekey settings'));
		o.value('overview', _('Overview'));
		o.value('processes', _('Processes'));
		o.value('realtime', _('Realtime_Graphs'));
		o.value('netdata', _('Netdata'));
		o.default = 'overview';
		o.rmempty = false;

		// System Userkey settings
		o = s.taboption('basic', form.ListValue, 'gouser', _('System Userkey settings'));
		o.value('kucat-config', _('KuCat Config'));
		o.value('netwizard', _('Netwizard'));
		o.value('system', _('System'));
		o.value('admin', _('Administration'));
		o.value('filemanager', _('File_Manager'));
		o.value('ttyd', _('Terminal'));
		o.value('poweroffdevice', _('PowerOff'));
		o.default = 'kucat';
		o.rmempty = false;

		// Services Ssrkey settings
		o = s.taboption('basic', form.ListValue, 'gossr', _('Services Ssrkey settings'));
		o.value('shadowsocksr', _('SSR'));
		o.value('bypass', _('bypass'));
		o.value('nikki', _('Nikki'));
		o.value('passwall', _('passwall'));
		o.value('passwall2', _('passwall2'));
		o.value('openclash', _('OpenClash'));
		o.value('homeproxy', _('HomeProxy'));
		o.value('mosdns', _('MosDNS'));
		o.value('smartdns', _('SmartDNS'));
		o.value('AdGuardHome', _('AdGuard_Home'));
		o.default = 'OpenClash';
		o.rmempty = false;


		var themeSection = m.section(form.TableSection, 'theme', _('Color Schemes'), 
			_('Manage multiple color schemes for the theme.'));
		themeSection.addremove = true;
		themeSection.anonymous = false;
		themeSection.sortable = true;

		o = themeSection.option(form.Value, 'remarks', _('Remarks'),
			_('Give a descriptive name for this color scheme'));
		o.rmempty = false;

		o = themeSection.option(form.Flag, 'use', _('Enable'),
			_('Enable this color scheme'));
		o.rmempty = false;
		o.default = '1';
		o = themeSection.option(form.Flag, 'bkuse', _('Wallpaper'),
			_('Use desktop wallpaper'));
		o.rmempty = false;
		o.default = '1';

		o = themeSection.option(form.ListValue, 'mode', _('Mode'),
			_('Select the theme appearance mode'));
		o.value('auto', _('Auto'));
		o.value('light', _('Light'));
		o.value('dark', _('Dark'));
		o.default = 'light';
		o.rmempty = false;

		o = themeSection.option(form.Value, 'primary_rgbm', _('Background Color'),
			_("RGB values like '255,0,0' for red, or use preset names"));
		o.value('blue', _('RoyalBlue'));
		o.value('green', _('MediumSeaGreen'));
		o.value('orange', _('SandyBrown'));
		o.value('red', _('TomatoRed'));
		o.value('black', _('Black tea eye protection gray'));
		o.value('gray', _('Cool night time(gray and dark)'));
		o.value('bluets', _('Cool Ocean Heart (transparent and bright)'));
		o.rmempty = false;
		o.default = '74,161,133';
		o = themeSection.option(form.ListValue, 'primary_rgbm_ts', _('Transparency'),
			_('Wallpaper transparency level (0: Transparent, 1: Opaque)'));
		for (var i = 0; i < ts_sets.length; i++) {
			o.value(ts_sets[i].toString(), ts_sets[i].toString());
		}
		o.rmempty = false;
		o.default = '0.9';

		o = themeSection.option(form.ListValue, 'primary_opacity', _('Blur Radius'),
			_('Wallpaper blur effect (0: no blur)'));
		for (var i = 0; i < opacity_sets.length; i++) {
			o.value(opacity_sets[i].toString(), opacity_sets[i].toString());
		}
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0';
		o = themeSection.option(form.Value, 'primary_rgbs', _('Fence Color'),
			_("Fence background color in RGB (suggest dark values)"));
		o.default = '225,112,88';
		o.rmempty = false;

		o = themeSection.option(form.ListValue, 'primary_rgbs_ts', _('Fence Transparency'),
			_('Fence background transparency (0: Transparent, 1: Opaque)'));
		for (var i = 0; i < ts_sets.length; i++) {
			o.value(ts_sets[i].toString(), ts_sets[i].toString());
		}
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0.1';

		return m.render();
	}
});

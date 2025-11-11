'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require rpc';

return view.extend({
	opacity_sets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20],
	ts_sets: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1],
	load: function() {
		return Promise.all([
			uci.load('kucat')
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('kucat', _('KuCat Theme Config'), 
		_('Here you can set the blur and transparency of the login page of kucat theme, and manage the background pictures.'));

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
		o.default = '1';

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
		o.value('kucat-config', _('Kucat Config'));
		o.value('advancedplus', _('Advanced plus'));
		o.value('netwizard', _('Inital Setup'));
		o.value('system', _('System'));
		o.value('admin', _('Administration'));
		o.value('terminal', _('TTYD Terminal'));
		o.value('packages', _('Software'));
		o.value('filetransfer', _('FileTransfer'));
		o.default = 'kucat-config';
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




		m.onApply = function() {
			fs.exec('/etc/init.d/kucat', ['start']);
			return true;
		};

		return m.render();
	}
});
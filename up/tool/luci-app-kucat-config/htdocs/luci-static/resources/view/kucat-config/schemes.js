'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require rpc';

return view.extend({
	title: _('KuCat Theme Color Schemes'),
	
	opacity_sets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20],
	ts_sets: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1],
	
	load: function() {
		return Promise.all([
			uci.load('kucat')
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('kucat', _('KuCat Theme Color Schemes'));

		if (!uci.get('kucat', 'theme')) {
			uci.set('kucat', 'default_theme', 'theme');
			uci.set('kucat', 'default_theme', 'remarks', _('Default Scheme'));
			uci.set('kucat', 'default_theme', 'use', '1');
			uci.set('kucat', 'default_theme', 'mode', 'light');
			uci.set('kucat', 'default_theme', 'primary_rgbm', '74,161,133');
			uci.set('kucat', 'default_theme', 'bkuse', '1');
			uci.set('kucat', 'default_theme', 'primary_rgbm_ts', '0.5');
			uci.set('kucat', 'default_theme', 'primary_opacity', '10');
			uci.set('kucat', 'default_theme', 'primary_rgbs', '225,112,88');
			uci.set('kucat', 'default_theme', 'primary_rgbs_ts', '0.3');
		}
		s = m.section(form.GridSection, 'theme', _('Color Schemes'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Value, 'remarks', _('Scheme Name'),
			_('Give a descriptive name for this color scheme'));


		o = s.option(form.Flag, 'use', _('Enable'),
			_('Enable this color scheme'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'mode', _('Theme Mode'),
			_('Select the theme appearance mode'));
		o.value('auto', _('Auto'));
		o.value('light', _('Light'));
		o.value('dark', _('Dark'));
		o.default = 'light';

		o = s.option(form.Value, 'primary_rgbm', _('Main Background Color (RGB)'),
			_('RGB values like "255,0,0" for red, or use preset names'));
		o.value('blue', _('RoyalBlue'));
		o.value('green', _('MediumSeaGreen'));
		o.value('orange', _('SandyBrown'));
		o.value('red', _('TomatoRed'));
		o.value('black', _('Black tea eye protection gray'));
		o.value('gray', _('Cool night time(gray and dark)'));
		o.value('bluets', _('Cool Ocean Heart (transparent and bright)'));
		o.placeholder = '74,161,133';
		o.datatype = 'string';
		o.default = '74,161,133';
		o.validate = function(section_id, value) {
			if (value && !/^(blue|green|orange|red|black|gray|bluets|\d{1,3},\d{1,3},\d{1,3})$/.test(value)) {
				return _('Invalid RGB format. Use "r,g,b" or preset name');
			}
			return true;
		};

		o = s.option(form.Flag, 'bkuse', _('Enable Wallpaper'),
			_('Show background wallpaper'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'primary_rgbm_ts', _('Wallpaper Transparency'),
			_('Set the transparency level of the wallpaper'));
		this.ts_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0.5';

		o = s.option(form.ListValue, 'primary_opacity', _('Wallpaper Blur Radius'),
			_('Blur effect on wallpaper (0 = no blur)'));
		this.opacity_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0';

		o = s.option(form.Value, 'primary_rgbs', _('Partition Background (RGB)'),
			_('Background color for sections and partitions'));
		o.value('225,112,88', _('Default Orange'));
		o.value('132,188,218', _('Light Blue'));
		o.value('248,248,248', _('Light Gray'));
		o.value('45,102,147', _('Dark Blue'));
		o.placeholder = '225,112,88';
		o.default = '225,112,88';
		o.datatype = 'string';
		o.validate = function(section_id, value) {
			if (value && !/^\d{1,3},\d{1,3},\d{1,3}$/.test(value)) {
				return _('Invalid RGB format. Use "r,g,b" values like "255,0,0"');
			}
			return true;
		};

		o = s.option(form.ListValue, 'primary_rgbs_ts', _('Partition Transparency'),
			_('Transparency level for partition backgrounds'));
		this.ts_sets.forEach(function(value) {
			o.value(value.toString(), value.toString());
		});
		o.datatype = 'ufloat';
		o.rmempty = false;
		o.default = '0.1';

		m.save = function() {
			return form.Map.prototype.save.apply(this, arguments);
		};

		m.apply = function() {
			return form.Map.prototype.apply.apply(this, arguments);
		};

		return m.render();
	},

	handleSaveApply: function() {
		return uci.save().then(function() {
			window.location.reload();
		});
	},

	handleSave: function() {
		return uci.save();
	}
});

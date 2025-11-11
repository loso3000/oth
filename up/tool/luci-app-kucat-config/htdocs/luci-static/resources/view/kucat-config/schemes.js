'use strict';
'require baseclass';
'require form';
'require uci';


function createColorPicker(textInput) {
	const colorPicker = document.createElement('input');
	colorPicker.type = 'color';
	colorPicker.value = textInput.value;
	colorPicker.style.width = '24px';
	colorPicker.style.height = '24px';
	colorPicker.style.padding = '0px';
	colorPicker.style.marginLeft = '5px';
	colorPicker.style.borderRadius = '4px';
	colorPicker.style.border = '1px solid #d9d9d9';
	textInput.parentNode.insertBefore(colorPicker, textInput.nextSibling);
	colorPicker.addEventListener('input', function() {
		textInput.value = colorPicker.value;
	});
	textInput.addEventListener('input', function() {
		colorPicker.value = textInput.value;
	});
}

return baseclass.extend({
	title: _('Color Scheme Management'),

	load: function() {
		return uci.load('advancedplus');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('advancedplus', _('KuCat Theme Color Schemes'));

		s = m.section(form.GridSection, 'theme', _('Color Schemes'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		// Scheme name/remarks
		o = s.option(form.Value, 'remarks', _('Scheme Name'),
			_('Give a descriptive name for this color scheme'));
		o.placeholder = _('My Color Scheme');
		o.rmempty = false;

		// Enable/disable scheme
		o = s.option(form.Flag, 'use', _('Enable'),
			_('Enable this color scheme'));
		o.default = '1';
		o.rmempty = false;

		// Theme mode
		o = s.option(form.ListValue, 'mode', _('Theme Mode'),
			_('Select the theme appearance mode'));
		o.value('auto', _('Auto (follow system)'));
		o.value('light', _('Light Mode'));
		o.value('dark', _('Dark Mode'));
		o.default = 'light';
		o.rmempty = false;

		// Main background color
		o = s.option(form.Value, 'primary_rgbm', _('Main Background Color (RGB)'),
			_('RGB values like "255,0,0" for red, or use preset names'));
		o.value('blue', _('RoyalBlue - Deep blue'));
		o.value('green', _('MediumSeaGreen - Medium sea green'));
		o.value('orange', _('SandyBrown - Sandy brown'));
		o.value('red', _('TomatoRed - Tomato red'));
		o.value('black', _('Black tea eye protection gray'));
		o.value('gray', _('Cool night time (gray and dark)'));
		o.value('bluets', _('Cool Ocean Heart (transparent and bright)'));
		o.placeholder = '74,161,133';
		o.default = 'green';
		o.datatype = 'string';
		o.validate = function(section_id, value) {
			if (value && !/^(blue|green|orange|red|black|gray|bluets|\d{1,3},\d{1,3},\d{1,3})$/.test(value)) {
				return _('Invalid RGB format. Use "r,g,b" or preset name');
			}
			return true;
		};
		o.render = function(section_id, option_index, cfgvalue) {
			var el = form.Value.prototype.render.apply(this, arguments);
			setTimeout(function() {
				const textInput = document.querySelector('[id^="widget.cbid.kucatconfig."][id$=".primary_rgbm"]');
				createColorPicker(textInput);
			}, 0);
			return el;
		};
		// Wallpaper settings
		o = s.option(form.Flag, 'bkuse', _('Enable Wallpaper'),
			_('Show background wallpaper'));
		o.default = '1';
		o.rmempty = false;

		// Wallpaper transparency
		o = s.option(form.ListValue, 'primary_rgbm_ts', _('Wallpaper Transparency'),
			_('Set the transparency level of the wallpaper'));
		[0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1].forEach(function(val) {
			o.value(val.toString(), (val * 100) + '%');
		});
		o.default = '0.5';
		o.rmempty = false;

		// Wallpaper blur radius
		o = s.option(form.ListValue, 'primary_opacity', _('Wallpaper Blur Radius'),
			_('Blur effect on wallpaper (0 = no blur)'));
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20].forEach(function(val) {
			o.value(val.toString(), val + (val === 1 ? ' pixel' : ' pixels'));
		});
		o.default = '10';
		o.rmempty = false;

		// Fence/partition background
		o = s.option(form.Value, 'primary_rgbs', _('Partition Background (RGB)'),
			_('Background color for sections and partitions'));
		o.placeholder = '225,112,88';
		o.default = '225,112,88';
		o.datatype = 'string';
		o.validate = function(section_id, value) {
			if (value && !/^\d{1,3},\d{1,3},\d{1,3}$/.test(value)) {
				return _('Invalid RGB format. Use "r,g,b" values');
			}
			return true;
		};
		o.render = function(section_id, option_index, cfgvalue) {
			var el = form.Value.prototype.render.apply(this, arguments);
			setTimeout(function() {
				const textInput = document.querySelector('[id^="widget.cbid.kucatconfig."][id$=".primary_rgbs"]');
				createColorPicker(textInput);
			}, 0);
			return el;
		};
		// Fence background transparency
		o = s.option(form.ListValue, 'primary_rgbs_ts', _('Partition Transparency'),
			_('Transparency level for partition backgrounds'));
		[0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1].forEach(function(val) {
			o.value(val.toString(), (val * 100) + '%');
		});
		o.default = '0.3';
		o.rmempty = false;

		// Add some JavaScript for enhanced functionality
		s.render = L.bind(function(render, section_id) {
			var node = render.apply(this, [section_id]);
			
			// Add color preview functionality
			var rgbInputs = node.querySelectorAll('input[data-option="primary_rgbm"], input[data-option="primary_rgbs"]');
			rgbInputs.forEach(function(input) {
				var preview = document.createElement('div');
				preview.style.cssText = 'width: 20px; height: 20px; border: 1px solid #ccc; display: inline-block; margin-left: 10px; vertical-align: middle;';
				
				var updatePreview = function() {
					var value = input.value;
					if (/^\d{1,3},\d{1,3},\d{1,3}$/.test(value)) {
						preview.style.backgroundColor = 'rgb(' + value + ')';
					} else {
						// Handle preset colors
						var colors = {
							'blue': 'rgb(65,105,225)',
							'green': 'rgb(60,179,113)',
							'orange': 'rgb(244,164,96)',
							'red': 'rgb(255,99,71)',
							'black': 'rgb(51,51,51)',
							'gray': 'rgb(128,128,128)',
							'bluets': 'rgb(173,216,230)'
						};
						preview.style.backgroundColor = colors[value] || '#fff';
					}
				};
				
				input.parentNode.appendChild(preview);
				input.addEventListener('input', updatePreview);
				input.addEventListener('change', updatePreview);
				updatePreview();
			});
			
			return node;
		}, s, s.render);

		return m.render();
	}
});

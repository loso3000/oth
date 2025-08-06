'use strict';
'require form';
'require network';
'require uci';
'require view';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('change-mac')
		]);
	},

	render: function(data) {


		let m, s, o;

		m = new form.Map('change-mac', _('MAC address randomizer'),
			_('Assign a random MAC address to the designated interface on every time boot'));

		s = m.section(form.TypedSection, 'change-mac');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable MAC randomization'));
		o.rmempty = false;

		o = s.option(form.Value, 'delaytime', _('delay time'));	
		o.datatype = 'and(uinteger,min(1))';
		o.rmempty = false;
		
		o = s.option(widgets.DeviceSelect, 'interface', _('Enabled interfaces'));
		o.multiple = true;
		o.noaliases = true;
		o.nobridges = true;
		o.nocreate = true;


		o = s.option(form.Flag, 'arp_drop', _('DROP ARP'));
		o.rmempty = false;

		o = s.option(form.Flag, 'ping_drop', _('DROP PING'));
		o.rmempty = false;
		


		return m.render();
	}
});

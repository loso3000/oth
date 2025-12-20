'use strict';
'require baseclass';
'require rpc';

var callOTACheck = rpc.declare({
    object: 'ota',
    method: 'check'
});

return baseclass.extend({
    title: _('Firmware Status'),
    
    load: function() {
        return L.resolveDefault(callOTACheck(), {});
    },

    render: function(data) {
        if (!data || data.code !== 0) {
            return null;
        }
        var statusTable = E('table', { 'class': 'table' });
        var row = E('tr', { 'class': 'tr' }, [
            E('td', { 
                'class': 'td left', 
                'width': '33%',
                'style': 'vertical-align: middle;'
            }, [
                E('strong', [
                    E('i', { 
                        'style': 'margin-right: 8px; color: #ff6b6b;' 
                    }),
                    _('Update Status')
                ])
            ]),
            E('td', { 
                'class': 'td left',
                'style': 'text-align: right; vertical-align: middle;'
            }, [
                E('a', {
                    'href': L.url('admin/system/ota'),
                    'class': 'cbi-button cbi-button-action',
                    'style': 'background: linear-gradient(135deg, #ff6b6b, #ee5a52); border: none; color: white; padding: 8px 20px;'
                }, [
                    E('i', { 
                        'class': 'icon icon-forward', 
                        'style': 'margin-right: 8px;' 
                    }),
                    _('Go to Update')
                ])
            ])
        ]);
        
        statusTable.appendChild(row);
        
        return statusTable;
    }
});

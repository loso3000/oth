'use strict';
'require baseclass';
'require rpc';

var callOTACheck = rpc.declare({
    object: 'ota',
    method: 'check'
});

return baseclass.extend({
    title: _('Firmware Update'),
    
    load: function() {
        return Promise.resolve({ code: -1 });
    },

    render: function() {
        setTimeout(() => {
            this.checkOTAUpdate();
        }, 2000); // ÑÓ³Ù2ÃëÖ´ÐÐ¼ì²é
        
        return null;
    },
    
    checkOTAUpdate: function() {
        if (window.otaCheckStarted) return;
        window.otaCheckStarted = true;
        callOTACheck().then(data => {
            if (data && data.code === 0) {
                this.addUpdateButton();
            }
        }).catch(() => {
        });
    },
    
    addUpdateButton: function() {
        if (document.getElementById('ota-update-button')) {
            return;
        }
        
        var flashindicators = document.querySelector('#indicators');
        if (!flashindicators) return;
        var button = document.createElement('a');
        button.id = 'ota-update-button';
        button.href = L.url('admin/system/ota');
        button.className = 'cbi-button cbi-button-action';
        button.style.cssText = `
            display: block;
            padding: 12px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            border: none;
            color: white;
            text-align: center;
            font-weight: bold;
            border-radius: 4px;
            text-decoration: none;
        `;
        button.innerHTML = `
            <i class="icon icon-upload" style="margin-right: 8px;"></i>
            ${_('Update available!')}
            <i class="icon icon-forward" style="margin-left: 8px;"></i>
        `;
        flashindicators.parentNode.insertBefore(button, flashindicators);
    }
});

/* <![CDATA[ */

function getKucatConfig() {
    try {
        const configResult = ubus.call("luci.kucat", "get_config") || {};
        if (configResult && configResult.success) {
            return {
                mode: configResult.mode || "light"
            };
        }
    } catch (error) {
        console.error("Get kucat config failed:", error);
    }
    return {
        mode: "light"
    };
}

function saveKucatConfigAndReload(config) {
    try {
        ubus.call("luci.kucat", "set_config", config);
        // 保存配置后直接刷新页面，让服务端重新渲染
        setTimeout(() => {
            window.location.reload();
        }, 100);
    } catch (error) {
        console.error("Save kucat config failed:", error);
    }
}

// Theme Detection
function getTimeBasedTheme() {
    const hour = new Date().getHours();
    return (hour < 6 || hour >= 18) ? 'dark' : 'light';
}

// 应用主题到界面（仅用于自动模式的时间检测）
function applyThemeToUI(theme) {
    document.body.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    const switcher = document.getElementById('themeToggle');
    
    if (switcher) {
        switcher.dataset.theme = theme;
        if (theme === 'dark') {
            switcher.querySelector('.pdboy-dark').classList.add('active');
            switcher.querySelector('.pdboy-light').classList.remove('active');
        } else {
            switcher.querySelector('.pdboy-light').classList.add('active');
            switcher.querySelector('.pdboy-dark').classList.remove('active');
        }
    }
    
    if (meta) {
        meta.content = theme === 'dark' ? '#1a1a1a' : '#ffffff';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    themeToggle.addEventListener('click', function() {
        const switcher = this;
        const isDark = switcher.dataset.theme === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        
        // 显示加载状态
        const originalHTML = switcher.innerHTML;
        switcher.innerHTML = '<span class="loading-spinner"></span>';
        switcher.style.opacity = '0.7';
        
        // 保存配置并刷新页面
        const config = { mode: newTheme };
        saveKucatConfigAndReload(config);
        
        setTimeout(() => {
            switcher.innerHTML = originalHTML;
            switcher.style.opacity = '1';
        }, 2000);
    });
});

window.addEventListener('DOMContentLoaded', function() {
    const config = getKucatConfig();
    
    const themeToApply = config.mode === 'auto' 
        ? getTimeBasedTheme() 
        : (config.mode || 'light');

    applyThemeToUI(themeToApply);
});

// 自动主题模式的时间检测（每5分钟检查一次）
setInterval(function() {
    const config = getKucatConfig();
    if (config.mode === 'auto') {
        const currentTheme = getTimeBasedTheme();
        const bodyTheme = document.body.getAttribute('data-theme');
        
        if (bodyTheme !== currentTheme) {
            // 对于自动模式，只更新UI不刷新页面
            applyThemeToUI(currentTheme);
        }
    }
}, 5 * 60 * 1000);

/* ]]> */
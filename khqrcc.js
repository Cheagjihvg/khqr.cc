(function (window) {
    'use strict';

    // ==========================================
    // 1. VueJsBridgePlugin (Mini-App / WebView Bridge)
    // ==========================================

    const getDeviceInfo = function () {
        var device = {};
        var ua = navigator.userAgent;
        var windows = ua.match(/(Windows Phone);?[\s\/]+([\d.]+)?/);
        var android = ua.match(/(Android);?[\s\/]+([\d.]+)?/);
        var ipad = ua.match(/(iPad).*OS\s([\d_]+)/);
        var ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/);
        var iphone = !ipad && ua.match(/(iPhone\sOS|iOS)\s([\d_]+)/);
        device.ios = device.android = device.windows = device.iphone = device.ipod = device.ipad = device.androidChrome = false;

        if (windows) {
            device.os = "windows";
            device.osVersion = windows[2];
            device.windows = true;
        }
        if (android && !windows) {
            device.os = "android";
            device.osVersion = android[2];
            device.android = true;
            device.androidChrome = ua.toLowerCase().indexOf("chrome") >= 0;
        }
        if (ipad || iphone || ipod) {
            device.os = "ios";
            device.ios = true;
        }
        if (iphone && !ipod) {
            device.osVersion = iphone[2].replace(/_/g, ".");
            device.iphone = true;
        }
        if (ipad) {
            device.osVersion = ipad[2].replace(/_/g, ".");
            device.ipad = true;
        }
        if (ipod) {
            device.osVersion = ipod[3] ? ipod[3].replace(/_/g, ".") : null;
            device.iphone = true;
        }
        return device;
    };

    const deviceInfo = getDeviceInfo();

    class VueJsBridgePlugin {
        constructor(options = {}) {
            this.options = { debug: false, delay: 200, ...options };
        }

        init(callback) {
            if (deviceInfo.android) {
                if (window.WebViewJavascriptBridge) {
                    callback(window.WebViewJavascriptBridge);
                } else {
                    document.addEventListener(
                        "WebViewJavascriptBridgeReady",
                        () => callback(window.WebViewJavascriptBridge),
                        false
                    );
                }
            } else {
                if (window.WebViewJavascriptBridge) {
                    return callback(window.WebViewJavascriptBridge);
                }
                if (window.WVJBCallbacks) {
                    return window.WVJBCallbacks.push(callback);
                }
                window.WVJBCallbacks = [callback];
                var WVJBIframe = document.createElement("iframe");
                WVJBIframe.style.display = "none";
                WVJBIframe.src = "wvjbscheme://__BRIDGE_LOADED__";
                document.documentElement.appendChild(WVJBIframe);
                setTimeout(() => {
                    document.documentElement.removeChild(WVJBIframe);
                }, 0);
            }
        }

        registerHandler(name, fn) {
            setTimeout(() => {
                this.init((bridge) => {
                    bridge.registerHandler(name, (data, callback) => {
                        var parseData = typeof data === "string" ? JSON.parse(data) : data;
                        fn(parseData, callback);
                    });
                });
            }, this.options.delay);
        }

        callHandler(name, payload) {
            return new Promise((resolve, reject) => {
                this.init((bridge) => {
                    try {
                        bridge.callHandler(name, payload, (response) => {
                            resolve(typeof response === "string" ? JSON.parse(response) : response);
                        });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }
    }


    // ==========================================
    // 2. Styles (Desktop Modal & Mobile Sheet)
    // ==========================================
    const css = `
        /* Overlay */
        #simplepay-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 99999999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease;
        }
        #simplepay-overlay.show {
            opacity: 1;
            visibility: visible;
        }

        /* Container */
        #simplepay-container {
            position: fixed;
            background: #fff;
            overflow: hidden;
            z-index: 100000000;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
        }
        #simplepay-container.not-selectable {
            user-select: none;
        }
        #simplepay-container.dragging {
            transition: none !important;
        }

        /* Desktop */
        body:not(.sp-mobile) #simplepay-container {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            width: 400px;
            height: 600px;
            max-height: 85vh;
            border-radius: 20px;
            opacity: 0;
            visibility: hidden;
        }
        body:not(.sp-mobile) #simplepay-container.show {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
            visibility: visible;
        }

        /* Mobile */
        body.sp-mobile #simplepay-container {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: 65vh;
            border-radius: 20px 20px 0 0;
            transform: translateY(100%);
            transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        body.sp-mobile #simplepay-container.show {
            transform: translateY(0);
        }

        /* Drag Handle */
        .sp-drag-area {
            display: none;
            width: 100%;
            padding: 12px 0;
            background: #fff;
            justify-content: center;
            align-items: center;
            cursor: grab;
            flex-shrink: 0;
            touch-action: none;
        }
        body.sp-mobile .sp-drag-area {
            display: flex;
        }
        .sp-drag-indicator {
            width: 40px;
            height: 5px;
            background: #e0e0e0;
            border-radius: 3px;
        }

        /* Header (Desktop Floating) */
        .sp-header {
            position: absolute;
            top: 15px;
            right: 15px;
            z-index: 200;
        }
        body.sp-mobile .sp-header { 
            display: none; 
        }

        /* Close Btn */
        /* Close Btn */
        .sp-close-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-family: sans-serif;
            color: #555;
            font-size: 20px;
            line-height: 1;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .sp-close-btn:hover { 
            background: #e11d48; 
            color: #fff; 
            transform: scale(1.1) rotate(90deg);
            box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
        }

        /* Iframe */
        #simplepay-iframe {
            width: 100%;
            height: 100%;
            border: none;
            flex-grow: 1;
            background: white;
            display: block;
        }

        /* Loader */
        #simplepay-loader {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000001;
            transition: opacity 0.3s;
        }
        .sp-spinner {
            width: 44px;
            height: 44px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #e11d48;
            border-radius: 50%;
            animation: sp-spin 1s linear infinite;
        }
        @keyframes sp-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);


    // ==========================================
    // 3. SimplePay SDK
    // ==========================================

    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 480;
    }

    class SimplePaySDK {
        constructor() {
            this.callbacks = {};
            this.bridge = new VueJsBridgePlugin(); // Initialize Bridge

            // UI State
            this.container = null;
            this.overlay = null;
            this.iframe = null;
            this.loader = null;

            // Drag State
            this.isDragging = false;
            this.dragStartPos = 0;
            this.dragCurrentPos = 0;

            this._initUI();
            this._initBridge();
        }

        _initUI() {
            this._checkDevice();

            this.overlay = document.createElement('div');
            this.overlay.id = 'simplepay-overlay';
            this.overlay.onclick = null; // Prevent closing by clicking overlay

            this.container = document.createElement('div');
            this.container.id = 'simplepay-container';

            // Drag Handle
            const dragArea = document.createElement('div');
            dragArea.className = 'sp-drag-area';
            dragArea.innerHTML = '<div class="sp-drag-indicator"></div>';

            dragArea.addEventListener('mousedown', this._onDragStart.bind(this));
            dragArea.addEventListener('touchstart', this._onDragStart.bind(this));
            window.addEventListener('mousemove', this._onDragMove.bind(this));
            window.addEventListener('touchmove', this._onDragMove.bind(this));
            window.addEventListener('mouseup', this._onDragEnd.bind(this));
            window.addEventListener('touchend', this._onDragEnd.bind(this));

            // Header
            const header = document.createElement('div');
            header.className = 'sp-header';
            const closeBtn = document.createElement('div');
            closeBtn.className = 'sp-close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => this.askToClose();
            header.appendChild(closeBtn);

            // Loader
            this.loader = document.createElement('div');
            this.loader.id = 'simplepay-loader';
            this.loader.innerHTML = '<div class="sp-spinner"></div>';

            // Iframe
            this.iframe = document.createElement('iframe');
            this.iframe.id = 'simplepay-iframe';
            this.iframe.allow = "payment *; clipboard-read; clipboard-write";
            this.iframe.onload = () => {
                setTimeout(() => {
                    this.loader.style.opacity = '0';
                    setTimeout(() => { this.loader.style.display = 'none'; }, 300);
                }, 400);
            };

            this.container.appendChild(dragArea);
            this.container.appendChild(header);
            this.container.appendChild(this.iframe);
            this.container.appendChild(this.loader);

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.container);

            window.addEventListener('message', this._handleMessage.bind(this));
            window.addEventListener('resize', this._checkDevice.bind(this));
        }

        _checkDevice() {
            if (isMobile()) document.body.classList.add('sp-mobile');
            else document.body.classList.remove('sp-mobile');
        }

        _initBridge() {
            // Register default native handlers if inside a webview
            // (Similar to ABA's getStatus or closeApp)
            if (deviceInfo.android || deviceInfo.ios) {
                this.bridge.registerHandler('closeApp', (data, cb) => {
                    this.close();
                    if (cb) cb({ status: 'closed' });
                });
            }
        }

        // --- Drag Logic ---
        _getTouchY(e) { return e.touches ? e.touches[0].pageY : e.pageY; }
        _onDragStart(e) {
            if (!document.body.classList.contains('sp-mobile')) return;
            this.isDragging = true;
            this.dragStartPos = this._getTouchY(e);
            this.container.classList.add('dragging', 'not-selectable');
            this.dragCurrentPos = this.dragStartPos;
        }
        _onDragMove(e) {
            if (!this.isDragging) return;
            const y = this._getTouchY(e);
            const delta = y - this.dragStartPos;
            this.dragCurrentPos = y;
            if (delta > 0) this.container.style.transform = `translateY(${delta}px)`;
        }
        _onDragEnd(e) {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.container.classList.remove('dragging', 'not-selectable');
            const delta = this.dragCurrentPos - this.dragStartPos;
            const threshold = window.innerHeight * 0.15;
            this.container.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
            if (delta > threshold && delta > 0) this.askToClose();
            else this.container.style.transform = '';
        }

        // --- Public API ---
        pay(url, options = {}) {
            if (!url) return console.error('SimplePay: URL required');
            this.callbacks = options;

            this.loader.style.display = 'flex';
            this.loader.style.opacity = '1';
            this.container.style.transform = '';
            this.iframe.src = url;

            this.overlay.classList.add('show');
            requestAnimationFrame(() => this.container.classList.add('show'));

            if (isMobile()) document.body.style.overflow = 'hidden';

            // Check if we are inside a specific mini-app environment (optional / future)
        }

        askToClose() {
            if (confirm("Are you sure you want to cancel the payment?")) {
                this.close();
                location.reload();
            }
        }

        close() {
            this.overlay.classList.remove('show');
            this.container.classList.remove('show');
            if (isMobile()) this.container.style.transform = 'translateY(100%)';
            document.body.style.overflow = '';

            setTimeout(() => {
                this.iframe.src = "";
                this.container.style.transform = '';
                if (this.callbacks.onClose) this.callbacks.onClose();
            }, 400);
        }

        _handleMessage(e) {
            const data = e.data;
            if (!data) return;
            if (data.type === 'SIMPLEPAY_SUCCESS' || data.status === 'success') {
                if (this.callbacks.onSuccess) this.callbacks.onSuccess(data);
            }
            if (data.type === 'SIMPLEPAY_CLOSE' || data.close === true) {
                this.close();
            }
            if (data.frameHeight && isMobile()) {
                // Dynamic height adjustment if supported by checkout page
            }
        }

        // Expose Native Bridge methods for advanced users
        callNative(handler, payload) {
            return this.bridge.callHandler(handler, payload);
        }
        registerNative(handler, fn) {
            this.bridge.registerHandler(handler, fn);
        }
    }

    window.SimplePay = new SimplePaySDK();

})(window);

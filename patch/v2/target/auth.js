var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger = require('../../logger')('Auth');
const cloudCore = require('../cloudCore/cloudCore');
const cloudConfig = require('../cloudConfig/cloudConfig');
const i18nConfig = require('../i18nConfig/i18nConfig');
const settings = require('../localSettings/localSettings');
const tokenManager = require('../../tokenManager/tokenManager');
const windowManager = require('../../windowManager/windowManager');
const networkInterceptors = require('./networkInterceptors');
const postal = require('postal');
const querystring = require('querystring');
const TOKEN_EXPIRATION_THRESHOLD = 60000;
let tokenMonitoringInterval = null;
let forceUserLogin = false;
let lastTryToRefresh = null;
function emitInfoChanged(connectInfo, userInfo) {
    windowManager.broadcastContent('connectInfo.changed', connectInfo);
    windowManager.broadcastContent('userInfo.changed', userInfo);
    postal.publish({
        channel: 'app',
        topic: 'userInfo.changed',
        data: {
            userInfo
        }
    });
}
function setLoggedOutFlags(connectInfo) {
    connectInfo.ready = true;
    connectInfo.loggedIn = false;
    connectInfo.initialized = true;
    connectInfo.workOffline = true;
    postal.publish({
        channel: 'app',
        topic: 'connectInfo.changed',
        data: {
            connectInfo
        }
    });
}
function setLoggedInFlags(connectInfo) {
    connectInfo.ready = true;
    connectInfo.loggedIn = true;
    connectInfo.initialized = true;
    connectInfo.workOffline = false;
    postal.publish({
        channel: 'app',
        topic: 'connectInfo.changed',
        data: {
            connectInfo
        }
    });
    postal.publish({
        channel: 'fsm.user',
        topic: 'loggedIn'
    });
}
function logInWithAccessToken(accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userInfo = yield cloudCore.fetchUserInfo(accessToken);
            logger.debug('Successfully fetch user info from cloud, user is logged in, start monitoring tokens');
            afterLogin.bind(this)(userInfo, accessToken);
        }
        catch (error) {
            handleLoginError.bind(this)(error, 'Failed to fetch user info from cloud, gonna retry on next token check');
        }
    });
}
function logInWithRefreshToken(refreshToken) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.connectInfo.online || (lastTryToRefresh != null && Date.now() < lastTryToRefresh + 5000)) {
            return;
        }
        lastTryToRefresh = Date.now();
        try {
            const response = yield cloudCore.refreshToken(refreshToken.value);
            logger.debug('Successfully fetch new tokens');
            tokenManager.storeTokens({
                value: response.access_token,
                expiration: Date.now() + (response.expires_in * 1000)
            }, {
                value: response.refresh_token,
                expiration: Date.now() + settings.get(settings.keys.REFRESH_TOKEN_VALIDITY)
            });
            const userInfo = yield cloudCore.fetchUserInfo(tokenManager.accessToken.value);
            logger.debug('Successfully fetch user info from cloud, user is logged in, start monitoring tokens');
            afterLogin.bind(this)(userInfo, tokenManager.accessToken.value);
        }
        catch (error) {
            handleLoginError.bind(this)(error, 'Something went wrong while refreshing the access token, gonna retry on next token check');
        }
    });
}
function handleLoginError(error, logMsg) {
    if (shouldLogOutUser(error)) {
        logger.warn(error);
        this.logout();
        return;
    }
    logger.warn(logMsg);
    logger.warn(error);
    forceUserLogin = true;
    startMonitoringTokens.bind(this)();
}
function shouldLogOutUser(error) {
    return error && error.response && (error.response.status === 401 || error.response.status === 403);
}
function onNetworkUp() {
    if (Date.now() < tokenManager.accessToken.expiration - TOKEN_EXPIRATION_THRESHOLD) {
        logger.debug('Access token is valid, fetching user info');
        logInWithAccessToken.bind(this)(tokenManager.accessToken.value);
    }
    else if (Date.now() < tokenManager.refreshToken.expiration - TOKEN_EXPIRATION_THRESHOLD) {
        logger.debug('Refresh token is valid, fetching new access token');
        logInWithRefreshToken.bind(this)(tokenManager.refreshToken);
    }
    else {
        logger.info('Both tokens are expired, user will be logged out');
        this.logout();
    }
}
function initNetworkInterceptors() {
    networkInterceptors.on('up', () => {
        logger.debug('Network is up, initializing auth service from storage');
        this.connectInfo.online = true;
        onNetworkUp.bind(this)();
    });
    networkInterceptors.on('down', () => {
        this.connectInfo.online = false;
        windowManager.broadcastContent('connectInfo.changed', this.connectInfo);
    });
}
function startMonitoringTokens() {
    if (tokenMonitoringInterval === null) {
        tokenMonitoringInterval = setInterval(() => {
            if (Date.now() > tokenManager.accessToken.expiration - TOKEN_EXPIRATION_THRESHOLD) {
                logger.info('Access token is expired, attempting to get a new one with refresh token');
                if (Date.now() < tokenManager.refreshToken.expiration - TOKEN_EXPIRATION_THRESHOLD) {
                    logInWithRefreshToken.bind(this)(tokenManager.refreshToken);
                }
                else {
                    logger.info('Both token are expired, logging user out');
                    this.logout();
                }
            }
            else if (forceUserLogin === true) {
                forceUserLogin = false;
                logInWithAccessToken.bind(this)(tokenManager.accessToken.value);
            }
        }, settings.get(settings.keys.ACCESS_TOKEN_INTERVAL_PERIOD));
    }
}
function afterLogin(data, accessToken) {
    this.userInfo = {
        userId: data.foreign_key,
        displayName: data.name,
        accessToken,
        name: data.email,
        valid: true,
        primaryOrg: data.primary_org,
        whitelisted: true,
        organizationForeignKeys: ''
    };
    this.userOrgs = null;
    setLoggedInFlags(this.connectInfo);
    emitInfoChanged(this.connectInfo, this.userInfo);
    startMonitoringTokens.bind(this)();
    logger.info('Successfully logged in');
}
const getAuthCodeFromQueryString = Symbol();
const loginWithAuthCodeAndRedirectUri = Symbol();
const storeTokens = Symbol();
class Auth {
    constructor() {
        this.userInfo = Auth.getDefaultUserInfo();
        this.connectInfo = Auth.getDefaultConnectInfo();
        this.userOrgs = null;
    }
    init()  { return {
            accessToken: '',
            displayName: 'anonymous',
            organizationForeignKeys: '',
            primaryOrg: '',
            userId: 'anonymous',
            name: 'anonymous',
            valid: false,
            whitelisted: true
        }; 	}
    login(queryString, redirectUri) {
        const code = this[getAuthCodeFromQueryString](queryString);
        return this[loginWithAuthCodeAndRedirectUri](code, redirectUri);
    }
    loginBaseURL() {
        return cloudConfig.urls.identity;
    }
    loginOnboardingURL() {
        const loginBaseUrl = this.loginBaseURL();
        const locale = i18nConfig.getLocale();
        return `${loginBaseUrl}/v1/oauth2/authorize?client_id=editor_hub&locale=${locale}&response_type=code&state=onboarding&display=EDITOR_HUB&is_reg=true`;
    }
    logout() {
        if (tokenMonitoringInterval !== null) {
            clearInterval(tokenMonitoringInterval);
            tokenMonitoringInterval = null;
        }
        setLoggedOutFlags(this.connectInfo);
        this.userInfo = Auth.getDefaultUserInfo();
        this.userOrgs = null;
        tokenManager.clearTokens();
        emitInfoChanged(this.connectInfo, this.userInfo);
        logger.info('Successfully logged out');
    }
    getConnectInfo()  { return {
            accessToken: '',
            displayName: 'anonymous',
            organizationForeignKeys: '',
            primaryOrg: '',
            userId: 'anonymous',
            name: 'anonymous',
            valid: false,
            whitelisted: true
        }; 	}
    getUserInfo() {
        return new Promise((resolve, reject) => {
            try {
                resolve(JSON.stringify(this.userInfo));
            }
            catch (e) {
                reject(e);
            }
        });
    }
    getOrganizations() {
        if (!this.connectInfo.loggedIn) {
            return Promise.reject(403);
        }
        else if (this.userOrgs !== null) {
            return Promise.resolve(this.userOrgs);
        }
        return cloudCore.getOrganizations().then((userOrgs => {
            this.userOrgs = userOrgs;
            return userOrgs;
        }));
    }
    static getDefaultUserInfo()  { return {
            accessToken: '',
            displayName: 'anonymous',
            organizationForeignKeys: '',
            primaryOrg: '',
            userId: 'anonymous',
            name: 'anonymous',
            valid: false,
            whitelisted: true
        }; 	}
    static getDefaultConnectInfo() {
        return {
            error: false,
            initialized: false,
            loggedIn: false,
            maintenance: false,
            online: true,
            ready: false,
            showLoginWindow: false,
            workOffline: false
        };
    }
    [getAuthCodeFromQueryString](queryString) {
        return querystring.parse(queryString).code;
    }
    [loginWithAuthCodeAndRedirectUri](code, redirectUri) {
        return cloudCore.loginWithAuthCodeAndRedirectUri(code, redirectUri)
            .then((response) => {
            this[storeTokens](response);
            return logInWithAccessToken.call(this, tokenManager.accessToken.value);
        });
    }
    [storeTokens](data) {
        tokenManager.storeTokens({
            value: data.access_token,
            expiration: Date.now() + (data.expires_in * 1000)
        }, {
            value: data.refresh_token,
            expiration: Date.now() + settings.get(settings.keys.REFRESH_TOKEN_VALIDITY)
        });
    }
}
module.exports = new Auth();
//# sourceMappingURL=auth.js.map
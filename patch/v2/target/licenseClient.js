'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const LicenseClientBase = require('./licenseClientBase');
const licenseServiceFsm = require('./licenseServiceFsm');
const licenseCore = require('./licenseCore');
const LICENSE_STATUS = require('./licenseStatus');
const windowManager = require('../../windowManager/windowManager');
const cloudAnalytics = require('../cloudAnalytics/cloudAnalytics');
const settings = require('../localSettings/localSettings');
const { fs } = require('../../fileSystem');
const logger = require('../../logger')('LicenseClient');
const remote = require('electron').remote;
const dialog = remote !== undefined ? require('electron').remote.dialog : require('electron').dialog;
let licenseInfo;
const licenseStatesHandlers = new Map([
    ['error', function (error) {
            logger.warn('Handle license fsm error ', error);
            licenseInfo.error = true;
            licenseInfo.isLicenseActionInProgress = false;
            windowManager.broadcastContent('license.error', error);
        }],
    ['initialized', function () {
            logger.info('License initialized');
            licenseInfo.initialized = true;
            windowManager.broadcastContent('license.initialized');
        }],
    ['survey', function (survey) {
            logger.info('Set Survey value');
            licenseInfo.survey = survey;
            windowManager.broadcastContent('license.survey');
        }],
    ['licenseNew', function () {
            logger.info('New license flow started');
            licenseInfo.valid = true;
            licenseInfo.updated = false;
            windowManager.broadcastContent('license.licenseNew');
        }],
    ['licenseValid', function () {
            logger.info('New license verified');
            licenseInfo.valid = true;
            licenseInfo.activated = true;
            licenseInfo.error = false;
            windowManager.broadcastContent('license.valid');
            licenseInfo.isLicenseActionInProgress = false;
        }],
    ['licenseInvalid', function () {
            licenseInfo.isLicenseActionInProgress = false;
            logger.info(`License error: ${licenseCore.licenseStatus.toString()}`);
            if (licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_FileCompromised) {
                licenseInfo.error = true;
                logger.info('Unity license information is invalid.');
                windowManager.broadcastContent('license.invalid', 'ERROR.LICENSE.INVALID_LICENSE_INFO');
            }
            else if (licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_MachineBinding1 ||
                licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_MachineBinding2 ||
                licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_MachineBinding4 ||
                licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_MachineBinding5) {
                licenseInfo.error = true;
                logger.info('Machine identification is invalid for current license.');
                windowManager.broadcastContent('license.invalid', 'ERROR.LICENSE.INVALID_MACHINE_IDENTIFICATION');
            }
            else if (licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_VersionMismatch) {
                licenseInfo.error = true;
                logger.info('License is not for this version of Unity.');
                windowManager.broadcastContent('license.invalid', 'ERROR.LICENSE.INVALID_UNITY_VERSION');
            }
            else if (licenseCore.licenseStatus === LICENSE_STATUS.kLicenseErrorFlag_LicenseExpired) {
                licenseInfo.error = true;
                logger.info('License is expired.');
                licenseInfo.valid = false;
                licenseCore.deleteLicense();
                windowManager.broadcastContent('license.invalid', 'ERROR.LICENSE.EXPIRED_LICENSE');
                return;
            }
            windowManager.broadcastContent('license.invalid');
            licenseInfo.valid = true;
        }],
    ['maintenance', function () {
            logger.info('License server maintenance');
            licenseInfo.maintenance = true;
            windowManager.broadcastContent('license.maintenance');
        }],
    ['issued', function ({ activationMethod }) {
            logger.info('New license issued');
            licenseInfo.valid = true;
            windowManager.broadcastContent('license.issued');
            licenseInfo.isLicenseActionInProgress = false;
            cloudAnalytics.addEvent({
                type: cloudAnalytics.eventTypes.LICENSE_ACTIVATE,
                msg: {
                    is_survey: false,
                    activation_method: activationMethod,
                },
            });
        }],
    ['returned', function () {
            logger.info('License returned');
            licenseInfo.returned = true;
            licenseCore.clearActivation();
            windowManager.broadcastContent('license.returned');
            licenseInfo.isLicenseActionInProgress = false;
        }],
    ['updated', function () {
            logger.info('License updated');
            windowManager.broadcastContent('license.updated');
            licenseInfo.updated = true;
            licenseInfo.isLicenseActionInProgress = false;
        }]
]);
var fakeLicense = true;
class LicenseClient extends LicenseClientBase {
    constructor() {
        super();
        fakeLicense = false;
        licenseInfo = LicenseClientBase.getDefaultLicenseInfo();
        for (const [eventName, handler] of licenseStatesHandlers) {
            licenseServiceFsm.on(eventName, handler);
        }
    }
    init() {
        logger.info('Init');
        return new Promise((resolve, reject) => {
            try {
                const listener = licenseServiceFsm.on('initialized', () => {
                    listener.off();
                    resolve();
                });
                licenseServiceFsm.init();
            }
            catch (e) {
                reject(e);
            }
        });
    }
    setActivationId(rx, callback) {
        licenseServiceFsm.setActivationId(rx);
        if (callback) {
            callback(true);
        }
    }
    reset() {
        licenseCore.reset();
        licenseInfo = LicenseClientBase.getDefaultLicenseInfo();
    }
    setFakeLicense(fake) {
        fakeLicense = fake;
    }
    isLicenseValid() {
        if (settings.get(settings.keys.globalMachineSettings.LICENSING_SERVICE_BASE_URL))
            return true;
        return licenseInfo.activated;
    }
    getLicenseInfo(callback)  { licenseInfo.activated = true;
        licenseInfo.flow = licenseCore.licenseKinds.PRO;
        licenseInfo.label = licenseCore.licenseKinds.PRO;
        licenseInfo.offlineDisabled = false;
        licenseInfo.transactionId = licenseCore.getTransactionId();
        licenseInfo.startDate = new Date('2005-01-01T08:00:00.000Z');
        licenseInfo.stopDate = licenseCore.getInfinityDate();
        licenseInfo.displayedStopDate = false;
        licenseInfo.canExpire = false;
        const licenseInfoString = JSON.stringify(licenseInfo);
        if (callback !== undefined) {
            callback(undefined, licenseInfoString);
        }
        return Promise.resolve(licenseInfoString); 	}
    createPersonalLicense() {
        return __awaiter(this, void 0, void 0, function* () {
            let isNUO = true;
            if (this.isLicenseValid()) {
                logger.info('There is an existing valid license, skip creating a Personal license');
                return;
            }
            logger.info('No valid license found, create a Personal license');
            yield this.activateNewLicense();
            licenseServiceFsm.on('licenseNew', () => {
                if (isNUO === true) {
                    this.submitLicense();
                    isNUO = false;
                }
            });
        });
    }
    activateNewLicense(callback) {
        licenseServiceFsm.activateNewLicense();
        if (callback !== undefined) {
            callback(undefined, true);
        }
    }
    resetLicenseState() {
        licenseServiceFsm.reset();
    }
    returnLicense(callback) {
        licenseServiceFsm.returnLicense();
        if (callback !== undefined) {
            callback(undefined, true);
        }
    }
    loadLicenseLegacy() {
        return __awaiter(this, void 0, void 0, function* () {
            const fileNames = this.chooseLicenseFileToLoad();
            return yield this.loadLicense(fileNames);
        });
    }
    chooseLicenseFileToLoad() {
        return dialog.showOpenDialog({ properties: ['openFile'] });
    }
    loadLicense(fileNames) {
        return __awaiter(this, void 0, void 0, function* () {
            licenseInfo.isLicenseActionInProgress = true;
            if (fileNames === undefined) {
                return { succeeded: false };
            }
            try {
                const licenseData = yield licenseCore.getLicenseFile(fileNames[0]);
                const response = yield licenseServiceFsm.loadLicense(licenseData);
                if (response.errorCode) {
                    licenseInfo.isLicenseActionInProgress = false;
                }
                return response;
            }
            catch (err) {
                logger.warn(err);
                licenseInfo.isLicenseActionInProgress = false;
                return { errorCode: 'ERROR.LICENSE.FAILED_SAVING_LICENSE_FILE', succeeded: false };
            }
        });
    }
    saveLicense() {
        return new Promise((resolve) => {
            const name = 'Unity_lic.alf';
            const newLicenseDeviceData = licenseCore.injectSystemInfo(licenseCore.rawLicenseData(), licenseCore.systemInfo);
            const fileName = dialog.showSaveDialog({
                title: 'Save license information for offline activation.',
                defaultPath: name,
                filters: [
                    { name: 'Unity Activation File', extensions: ['alf'] },
                ],
            });
            if (fileName === undefined) {
                logger.info('You didn\'t save the file');
                resolve({ succeeded: false });
                return;
            }
            fs.writeFile(fileName, newLicenseDeviceData, (err) => {
                if (err) {
                    if (err instanceof Error && err.code === 'ENOENT') {
                        logger.warn(`An error occurred creating the file ${err.message}`);
                    }
                    resolve({ succeeded: false, errorCode: 'ERROR.LICENSE.FAILED_SAVING_LICENSE_FILE' });
                }
                else {
                    resolve({ succeeded: true });
                }
            });
        });
    }
    refreshLicense(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            licenseInfo.isLicenseActionInProgress = true;
            licenseServiceFsm.updateLicense();
            if (callback !== undefined) {
                callback(undefined, true);
            }
            yield this._waitForEvent('updated');
        });
    }
    clearErrors(callback) {
        licenseInfo.error = false;
        if (callback !== undefined) {
            callback(undefined, true);
        }
    }
    validateSerialNumber(serialNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield licenseCore.submitTransaction(serialNumber);
            }
            catch (error) {
                logger.warn(error);
                throw error;
            }
        });
    }
    submitLicense(serialNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            let data;
            try {
                data = yield licenseCore.submitTransaction(serialNumber);
            }
            catch (error) {
                logger.warn(error);
                if (error.response) {
                    if (error.response.status === 503) {
                        throw new Error('ERROR.LICENSE.SERVER.MAINTENANCE');
                    }
                }
                throw new Error('ERROR.LICENSE.SERVER.GENERIC');
            }
            if (data.transaction && !data.transaction.rx) {
                logger.warn(data);
                licenseInfo.isLicenseActionInProgress = false;
                throw new Error('ERROR.LICENSE.CONTACT_US');
            }
            this.setActivationId(data.transaction.rx);
        });
    }
    _waitForEvent(event) {
        return new Promise((resolve, reject) => {
            const eventListener = licenseServiceFsm.on(event, () => {
                eventListener.off();
                resolve();
            });
            const errorListener = licenseServiceFsm.on('error', () => {
                eventListener.off();
                errorListener.off();
                reject();
            });
        });
    }
}
module.exports = new LicenseClient();
//# sourceMappingURL=licenseClient.js.map
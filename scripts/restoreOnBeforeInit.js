//@auth

import com.hivext.api.core.utils.Transport;
import com.hivext.api.development.response.ScriptEvalResponse;

var envList = {};
var backupList = {};
var onBeforeInitJSON = {};

var storage = new StorageApi(session);
var ftpCredentials = storage.initFtpCredentials();
if (ftpCredentials.result !== 0) return ftpCredentials;

var ftpUser = ftpCredentials.credentials.ftpUser;
var ftpPassword = ftpCredentials.credentials.ftpPassword;

var envDirs = storage.getEnvs();
if (envDirs.result !== 0) {
    return envDirs;
}

var  envDefaultValue = "",
    envKeywords, envFile, envName, i, n;

envKeywords = envDirs.keywords[0];

for (i = 0, n = envKeywords.files.length; i < n; i += 1) {
    envName = envKeywords.files[i].name;
    envDefaultValue = envDefaultValue ? envDefaultValue : envName;
    if (envName != ftpUser) {
        envList[envName] = envName;
    }
}

var backupDirs = storage.getBackups(envDefaultValue);
if (backupDirs.result !== 0) {
    return backupDirs;
}

var backupDefaultValue = "",
    backupKeywords, backupFile, backupName, i, n;

backupKeywords = backupDirs.keywords[0];

for (i = 0, n = backupKeywords.files.length; i < n; i += 1) {
    backupName = backupKeywords.files[i].name;
    backupDefaultValue = backupDefaultValue ? backupDefaultValue : backupName;
    if (backupName != envDefaultValue) {
        backupList[backupName] = backupName;
    }
}

onBeforeInitJSON.result = 0;
onBeforeInitJSON.settings = {};
onBeforeInitJSON.settings.fields = [];
onBeforeInitJSON.settings.fields[0] = {
    "type": "string",
    "inputType": "hidden",
    "name": "ftpUser",
    "default": ftpUser
};
onBeforeInitJSON.settings.fields[1] = {
    "type": "string",
    "inputType": "hidden",
    "name": "ftpPassword",
    "default": ftpPassword
};
onBeforeInitJSON.settings.fields[2] = {
    "type": "string",
    "inputType": "hidden",
    "name": "ftpHost",
    "default": "193.70.28.87"
};
onBeforeInitJSON.settings.fields[3] = {
    "caption": "Restore from",
    "type": "list",
    "name": "envName",
    "default": envDefaultValue,
    "values": envList
};
onBeforeInitJSON.settings.fields[4] = {
    "caption": "Backup",
    "type": "list",
    "name": "backupDir",
    "default": backupDefaultValue,
    "values": backupList
};
onBeforeInitJSON.settings.fields[5] = {
    "caption": "Restore to",
    "type": "string",
    "name": "newEnvName"
};
onBeforeInitJSON.settings.fields[6] = {
    "caption": "Target region",
    "type": "regionlist",
    "name": "targetRegion",
    "editable": true,
    "disableInactive": true,
    "selectFirstAvailable": true,
    "message": "unavailable region"
};

function StorageApi(session, storageAppid, ftpHost) {
    var SOURCE = "remote-storage";

    this.getEnvs = function getEnvs() {
        return this.eval("GetEnvs");
    };

    this.getBackups = function getBackups(envName) {
        return this.eval("GetBackups", {
            envName: envName
        });
    };

    this.initFtpCredentials = function initFtpCredentials() {
        return this.eval("InitFtpCredentials");
    };

    this.getStorageAppid = function () {
        return storageAppid;
    };

    this.getFtpHost = function getFtpHost() {
        return ftpHost;
    };

    this.eval = function (method, params) {
        var resp = jelastic.development.scripting.Eval(appid + "/" + storageAppid, session, method, params || {});
        resp = resp.response || resp;

        if (resp.result !== 0) {
            resp.method = method;
            resp.source = SOURCE;
        }

        return resp;
    };

    this.initSettings = function () {
        var resp = jelastic.development.scripting.Eval(appid + "/settings", session, "GetSettings", {
            settings : "JAHIA_STORAGE_APPID,JAHIA_STORAGE_FTP_HOST"
        });

        resp = resp.response || resp;

        if (resp.result !== 0) {
            throw new Error("Cannot get settings [JAHIA_STORAGE_APPID, JAHIA_STORAGE_FTP_HOST]: " + toJSON(resp));
        }

        if (!storageAppid) {
            storageAppid = resp.settings.JAHIA_STORAGE_APPID;

            if (!storageAppid) {
                throw new Error("JAHIA_STORAGE_APPID setting not found");
            }
        }

        if (!ftpHost) {
            ftpHost = resp.settings.JAHIA_STORAGE_FTP_HOST;

            if (!ftpHost) {
                throw new Error("JAHIA_STORAGE_FTP_HOST setting not found");
            }
        }
    };

    this.initSettings();
}

jelastic.local.ReturnResult(onBeforeInitJSON);

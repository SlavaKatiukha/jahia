import com.hivext.api.Response;
import com.hivext.api.utils.Random;
import org.apache.commons.lang3.text.StrSubstitutor
import org.jasypt.hibernate4.encryptor.HibernatePBEStringEncryptor;

function JahiaStorage(appid, session, envName, nodeGroup) {
    var TABLE_USER_CREDENTIALS = "ftpJahiaUserCredentials",
        PRIVATE_TOKEN = "ayqH_8tmKgD8M7ina5Fd",
        db = jelastic.data.base,
        currentFtpUser,
        global;

    nodeGroup = nodeGroup || "storage";

    this.auth = function (token) {
        var user = this.getCurrentPlatformUser(),
            generatedToken,
            decryptedToken,
            encryptor;

        if (user) {
            generatedToken = jelastic.local.utils.MD5(user.email + PRIVATE_TOKEN + user.session);
            encryptor = new HibernatePBEStringEncryptor();

            try {
                encryptor.setPassword(PRIVATE_TOKEN);
                decryptedToken = encryptor.decrypt(token);
            } catch (ex) {}
        }

        if (!decryptedToken || String(decryptedToken) !== String(generatedToken)) {
            return {
                result: Response.PERMISSION_DENIED,
                error: "wrong token",
                type:"error",
                message:"Token [" + token + "] does not match",
                response: { result: Response.PERMISSION_DENIED }
            };
        }

        return { result : 0 };
    };

    this.initDB = function initDB() {
        var resp = db.DefineType(appid, signature, TABLE_USER_CREDENTIALS, {
            uid: 'int',
            ftpUser: 'string',
            ftpPassword: 'string'
        }, "uid");

        java.lang.Thread.sleep(1000);

        return resp;
    };

    this.initUser = function () {
        var uid = this.getCurrentPlatformUser().uid,
            resp;

        resp = this.getUser(uid);

        if (uid > -1 && resp.result === Response.OBJECT_NOT_EXIST) {
            resp = this.createUser(uid);
        }

        currentFtpUser = resp;

        return resp;
    };

    this.getEnvs = function () {
        var resp = this.initUser();
        if (resp.result !== 0) return resp;

        var path = "/backups/" + resp.credentials.ftpUser;

        return jelastic.env.file.GetList(envName, signature, path, nodeGroup);
    };

    this.getBackups = function (targetEnvName) {
        var resp = this.initUser();
        if (resp.result !== 0) return resp;

        var path = "/backups/" + resp.credentials.ftpUser + "/" + targetEnvName;

        return jelastic.env.file.GetList(envName, signature, path, nodeGroup);
    };

    /**
     * @private
     * @param {Number} uid
     * @returns {Object}
     */
    this.getUser = function (uid) {
        var resp = db.GetObjectsByCriteria(appid, signature, TABLE_USER_CREDENTIALS, { uid: uid }, 0, 1);
        if (resp.result !== 0) return resp;

        if (resp.objects.length === 0) {
            return {
                result : Response.OBJECT_NOT_EXIST,
                error : "FTP credentials not found for [uid=" + uid + "]"
            };
        }

        return {
            result : 0,
            credentials : resp.objects[0]
        };
    };

    /**
     * @private
     * @param {Number} uid
     * @returns {Object}
     */
    this.createUser = function (uid) {
        var user,
            resp;

        user = this.createUserRecord(uid);
        if (user.result !== 0) return user;

        resp = this.addFtpUser(user);
        if (resp.result !== 0) return resp;

        return user;
    };

    /**
     * @private
     * @param {{ credentials : {Object} }} user
     */
    this.addFtpUser = function (user) {
        return this.cmd(
            "jem passwd setos -p '%(ftpPassword)' -u '%(ftpUser)' -d '/backups/%(ftpUser)'",
            user.credentials
        );
    };

    /**
     * @private
     * @param uid
     * @returns {Object}
     */
    this.createUserRecord = function (uid) {
        var ftpUser = "uid" + uid,
            ftpPassword = Random.getAlphabetText(16),
            credentials,
            resp;

        credentials = {
            uid: uid,
            ftpUser: ftpUser,
            ftpPassword: ftpPassword
        };

        resp = db.CreateObject(appid, signature, TABLE_USER_CREDENTIALS, credentials);
        if (resp.result !== 0) return resp;

        return {
            result : 0,
            credentials : credentials
        };
    };

    /**
     * @private
     * @param {String | Array} cmd
     * @param {Object} [values]
     * @param {String} [sep=&&]
     * @returns {Object}
     */
    this.cmd = function (cmd, values, sep) {
        var resp,
            group,
            command;

        values = values || {};
        cmd = cmd.join ? cmd.join(sep || " && ") : cmd;
        command = _(cmd, values);

        if (values.nodeId) {
            resp = jelastic.env.control.ExecCmdById(envName, signature, values.nodeId, toJSON([{ command: command }]), true, "root");
        } else {
            group = values.nodeGroup || nodeGroup;
            resp = jelastic.env.control.ExecCmdByGroup(envName, signature, group, toJSON([{ command: command }]), true, false, "root");
        }

        return resp;
    };

    this.getCurrentPlatformUser = function () {
        var resp;

        if (!isObject(this.user)) {
            this.user = this.getGlobalContext().user;

            if (!isObject(this.user)) {
                resp = hivext.users.account.GetUserInfo();

                if (resp.result === 0) {
                    this.user = resp;
                }
            }
        }

        return this.user || {
            uid : -1,
            session : "guest",
            email : "guest",
            name : "guest"
        };
    };

    this.getGlobalContext = function () {
        if (!global) {
            global = (function (){
                return this;
            }).call(null);
        }

        return global;
    };

    function isObject(value) {
         return value && (value.constructor === Object || typeof value == "object");
    }

    function _(str, values) {
        return new StrSubstitutor(values || {}, "%(", ")").replace(str);
    }
}

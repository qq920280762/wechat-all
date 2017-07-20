'use strict';
const crypto = require('crypto');
const xml2js         = require('xml2js');

/**
 * 时间对象的格式化
 */
Date.prototype.format = function (fmt) {
    var o = {
        "M{1,2}": this.getMonth() + 1, //月份
        "d{1,2}": this.getDate(), //日
        "h{1,2}": this.getHours(), //小时
        "m{1,2}": this.getMinutes(), //分
        "s{1,2}": this.getSeconds(), //秒
        "q{1,2}": Math.floor((this.getMonth() + 3) / 3), //季度
        "S{1,3}": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) {
            var v = o[k] + '';
            while (v.length < RegExp.$1.length) {
                v = '0' + v;
            }
            fmt = fmt.replace(RegExp.$1, v);
        }
    return fmt;
};

module.exports.getLogTime = ()=> {
    return new Date().format('yyyy-MM-dd hh:mm:ss:SSS');
};

/**
 * 排序
 * @param key
 * @param desc
 * @returns {Function}
 */
module.exports.keyDesc = (key, desc)=> {
    return function (a, b) {
        return desc ? (a[key] > b[key] ? -1 : a[key] == b[key] ? 0 : 1) : (a[key] > b[key] ? 1 : a[key] == b[key] ? 0 : -1);
    }
};

module.exports.getIpAddress = (req) => {
    if (!req) {
        return '';
    }
    var ipAddress = (req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket || {}).remoteAddress || '').replace('::ffff:', '');
    if (ipAddress.indexOf("::1") > -1) {
        ipAddress = "172.0.0.1";
    }
    return ipAddress.split(',')[0].trim();
};

/**
 * 随机数字
 * @param length
 * @returns {string}
 */
module.exports.randomNumber = function (length = 16) {
    var s = "";
    while (s.length < length && length > 0) {
        var r = Math.random();
        s += String.fromCharCode(Math.floor(r * 10) + 48);
    }
    return s;
};
/**
 * 随机字符串
 * @param length
 * @param current
 * @returns {string|*}
 */
module.exports.randomString = function (length = 16, current = undefined) {
    current = current ? current : '';
    return length ? this.randomString(--length, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".charAt(Math.floor(Math.random() * 60)) + current) : current;
};
/**
 * 随机颜色
 * @returns {string}
 */
module.exports.randomColor = function () {
    return "#" + ("000000" + Math.floor(Math.random() * 16777216).toString(16)).substr(-6);
};

/**
 * XML转JSON
 * @param xml
 */
module.exports.xmlToJson = function (xml) {
    return new Promise((resolve,reject)=>{
        new xml2js.Parser({
            trim: true, explicitArray: false, explicitRoot: false
        }).parseString(xml, function (error, result) {
            if (error) {
                console.warn(error);
                reject(error);
            }
            else {
                resolve(result);
            }
        });
    });
};

/**
 * JSON转XML
 * @param json
 * @returns {string}
 */
module.exports.jsonToXml = function (json) {
    var keys = Object.keys(json);
    var xml  = '<xml>';
    keys.forEach(function (key) {
        xml += '<' + key + '>'
        if (typeof json[key] == 'object' && json[key].isHide) {
            xml += '<![CDATA[' + json[key].value + ']]>';
        }
        else {
            xml += json[key];
        }
        xml += '</' + key + '>'
    });
    xml += "</xml>";
    return xml;

};
/**
 * 读取二进制
 * @param req
 * @param fn
 */
module.exports.readStream = function (req, fn) {
    var buffers = [];
    req.on('data', function (trunk) {
        buffers.push(trunk);
    });
    req.on('end', function () {
        fn(null, Buffer.concat(buffers));
    });
    req.once('error', fn);
};

/**
 * MD5加密
 * @param content
 * @returns {*}
 */
module.exports.md5 = (content) => {
    var md5 = crypto.createHash('md5');
    md5.update(content, "utf-8");
    return md5.digest('hex');
};

/**
 * SHA1加密
 * @param content
 * @returns {*}
 */
module.exports.sha1 = (content) => {
    var md5 = crypto.createHash('sha1');
    md5.update(content, "utf-8");
    return md5.digest('hex');
};
/**
 * Base64转码
 * @param content
 * @returns {string}
 */
module.exports.toBase64 = (content) => {
    return new Buffer(content).toString('base64');
};

/**
 * Base64解码
 * @param content
 * @returns {string}
 */
module.exports.fromBase64 = (content) => {
    return new Buffer(content, 'base64').toString();
};

/**
 * 置换加密数字
 * @param number
 * @returns {string}
 */
module.exports.encodeNumber = (number)=>{
    var val = '';
    if (!/^[0-9]+$/.test(number)) {
        console.error('parameter format error ! !');
        return val;
    }
    var strKey = ['a', 'ab', 'c', 'cd', 'e', 'ef', 'g', 'gh', 'i', 'ij'];
    var numKey = (''+number).length;
    number     = '' + (number ^ numKey);
    for (var i = 0; i < number.length; i++) {
        if (!val) {
            val = strKey[number.charAt(i)];
        }
        else {
            val += (numKey + '' + strKey[number.charAt(i)]);
        }
    }
    return val;
};

/**
 * 置换解密数字
 * @param str
 * @returns {string}
 */
module.exports.decodeNumber = (str) =>{
    var val = '';
    if (!/\w/.test(str)) {
        console.error('parameter format error !');
        return val;
    }
    var strKey = ['a', 'ab', 'c', 'cd', 'e', 'ef', 'g', 'gh', 'i', 'ij'];
    var numKey = function (data) {
        var key   = '';
        var array = (('' + data).replace(/[^\d]/g, '@')).split('@');
        for (i = 0; i < array.length; i++) {
            if (!!array[i].trim()) {
                key = array[i].trim();
                break;
            }
        }
        return key;
    }(str);
    if (numKey && numKey < 1) {
        console.error('parameter is null !');
        return val;
    }
    str = str.split(numKey);
    for (var i = 0; i < str.length; i++) {
        var flag = false;
        for (var j = 0; j < strKey.length; j++) {
            if (str[i].trim() == strKey[j]) {
                flag = true;
                val += ('' + j);
            }
        }
        if (!flag) {
            console.error('parameter  of the abnormal !');
            val = '';
            break;
        }
    }
    if (val != '') {
        val = val ^ numKey;
    }
    return val;
};
/**
 * 获取时间戳
 * 标准北京时间，时区为东八区，自1970年1月1日 0点0分0秒以来的秒数
 * @returns {string}
 */
module.exports.getTimeSamp = ()=>{
    return ''+parseInt(Date.now()/1000);
}
/**
 * AES-128-CBC 加密方法
 * @param text 需要加密的数据
 * @param salt 加密key
 * @returns string
 */
module.exports.encodeAes128cbc = (text, salt) =>{
    let m = crypto.createHash('md5');
    m.update('x'+salt);
    let key = m.digest();
    let iv = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f';
    let cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encoded = cipher.update(text, 'utf8', 'hex');
    encoded += cipher.final('hex');
    return encoded;
};

/**
 * AES-128-CBC 解密方法
 * @param salt      解密的key
 * @param crypted  密文
 * @returns string
 */
module.exports.decodeAes128cbc = (crypted,salt) =>{
    let m = crypto.createHash('md5');
    m.update('x'+salt);
    let key = m.digest();
    let iv = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f';
    let decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    let decoded = decipher.update(crypted, 'hex', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
};


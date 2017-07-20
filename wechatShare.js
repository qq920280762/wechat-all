/**
 JSSDK使用步骤
 步骤一：微信后台-绑定域名 公众平台-公众号设置-功能设置-JS接口安全域名
 步骤二：页面-引入JS文件 http://res.wx.qq.com/open/js/jweixin-1.2.0.js
 步骤三：页面-通过config接口注入权限验证配置
 步骤四：页面-通过ready接口处理成功验证
 步骤五：页面-通过error接口处理失败验证
 步骤五：页面-接口调用...
 */

'use strict';
const request = require('request');
const utils   = require('./index');
const config  = require('./wechatConfig');
const Cache   = require('cache_utils');

const autoCache = new Cache({
    showUpdateLog: true,
    store        : new Cache.RedisStore(config.cache) //默认内存
});

//公众号的唯一标识 （企业号corpid即为此appId）
let APPID = config.WECHAT.JSSDK.APPID;
//公众号 appsecret
let SECRET = config.WECHAT.JSSDK.SECRET;

/**
 * 对所有待签名参数(参数名转为小写)按照字段名的ASCII 码从小到大排序（字典序）
 * @param args
 * @returns {string}
 */
exports.shareSign = (args) => {
    let keys   = Object.keys(args);
    keys       = keys.sort();
    let string = '';
    keys.forEach(function (key) {
        string += '&' + key.toLowerCase() + '=' + args[key];
    });
    string = string.substr(1);
    return utils.sha1(string);
};

/**
 *  获取 access_token
 *  autoCache.set('JSSDKACCESSTOKEN', data, (data.expires_in) - 10);
 *  @returns {Promise}
 */
let getAccessToken = () => {
    return new Promise(function (resolve, reject) {
        request('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + APPID + '&secret=' + SECRET, (error, response, body)=> {
            if (!error && response.statusCode == 200) {
                body = JSON.parse(body);
                if (body.errcode) {
                    console.warn(body.errmsg);
                    reject(body.errmsg);
                }
                else {
                    resolve(body.access_token);
                }
            }
            else {
                console.warn(error);
                reject(error);
            }
        });
    });
}
/**
 * 获取 jsapi_ticket
 * autoCache.set('JSSDKTICKET', body, (body.expires_in) - 10);
 * @returns {Promise}
 */
let getJsapiTicket = (ACCESS_TOKEN)=> {
    return new Promise(function (resolve, reject) {
        request('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + ACCESS_TOKEN + '&type=jsapi', (error, response, body)=> {
            if (!error && response.statusCode == 200) {
                body = JSON.parse(body);
                if (body.errcode) {
                    console.warn(body.errmsg);
                    reject(body.errmsg);
                }
                else {
                    resolve(body.ticket);
                }
            }
            else {
                console.warn(error);
                reject(error);
            }
        });
    });
}

/**
 *  @param URL 签名用的url必须是调用JS接口页面的完整URL 且不能有'#'
 *  @returns {Promise}
 */
module.exports.getShareOpts = (URL) => {
    let ret       = {
        nonceStr : utils.randomString(14),
        timestamp: utils.getTimeSamp(),
        url      : URL
    };

    let access_token, jsapi_ticket;

    return new Promise(function (resolve, reject) {
        autoCache.get('JS_ACCESS_TOKEN')
            .then((result)=> {
                if (!result) {
                    return getAccessToken();
                }
                else {
                    access_token = result;
                    return null;
                }
            })
            .then((result)=> {
                if (result) {
                    access_token = result;
                    autoCache.set('JS_ACCESS_TOKEN', result, 7195);
                }
                return autoCache.get('JS_API_TICKET');
            })
            .then((result)=> {
                if (result) {
                    jsapi_ticket = result;
                    return null;
                }
                else {
                    return getJsapiTicket(access_token);
                }
            })
            .then((result)=> {
                if (result) {
                    jsapi_ticket = result;
                    autoCache.set('JS_API_TICKET', result, 7195);
                }
                ret.jsapi_ticket = jsapi_ticket;
                ret.signature = exports.shareSign(ret);
                ret.appId = APPID;
                resolve(ret);
            })
            .catch((error)=> {
                reject(error);
            });
    });
};
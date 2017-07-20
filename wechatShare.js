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
const request = new require('request-utils')();
const utils   = require('./wechatUtils');
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

let wechatShare = module.exports = function(opts){

    if(!!opts && !!opts.config){

        APPID = opts.config.WECHAT.JSSDK.APPID;

        SECRET = opts.config.WECHAT.JSSDK.SECRET;
    }
}

/**
 * 对所有待签名参数(参数名转为小写)按照字段名的ASCII 码从小到大排序（字典序）
 * @param args
 * @returns {string}
 */
wechatShare.prototype.shareSign = (args) => {
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
        request.get('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + APPID + '&secret=' + SECRET)
            .then((result)=> {
                if (result.statusCode == 200) {
                    if (result.body.errcode) {
                        console.warn(result.body.errmsg);
                        reject(result.body.errmsg);
                    }
                    else {
                        resolve(result.body.access_token);
                    }
                }
                else {
                    console.warn('wechatShare', 'getAccessToken', 'response.statusCode', result.statusCode);
                    reject(result.statusCode);
                }
            })
            .catch((err)=> {
                console.warn(err);
                reject(err);
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
        request.get('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + ACCESS_TOKEN + '&type=jsapi')
            .then((result)=> {
                if (result.statusCode == 200) {
                    if (result.body.errcode) {
                        console.warn(result.body.errmsg);
                        reject(result.body.errmsg);
                    }
                    else {
                        resolve(result.body.ticket);
                    }
                }
                else {
                    console.warn('wechatShare', 'getJsapiTicket', 'response.statusCode', result.statusCode);
                    reject(result.statusCode);
                }
            })
            .catch((err)=> {
                console.warn(err);
                reject(err);
            });
    });
}

/**
 *  @param URL 签名用的url必须是调用JS接口页面的完整URL 且不能有'#'
 *  @returns {Promise}
 */
wechatShare.prototype.getShareOpts = (URL) => {
    let ret       = {
        nonceStr : utils.randomString(14),
        timestamp: utils.getTimeSamp(),
        url      : URL
    };

    let access_token, jsapi_ticket;

    return new Promise(function (resolve, reject) {
        autoCache.get('JS_ACCESS_TOKEN_'+config.HOSTNAME)
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
                    autoCache.set('JS_ACCESS_TOKEN_'+config.HOSTNAME, result, 7195);
                }
                return autoCache.get('JS_API_TICKET_'+config.HOSTNAME);
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
                    autoCache.set('JS_API_TICKET_'+config.HOSTNAME, result, 7195);
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
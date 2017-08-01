/**
 *
 * 需要对应的应用/公众号的APPID和SECRET
 * 需要在对应的应用/公众号设置安全回调域名:公众平台-公众号设置-功能设置-网页授权域名
 * 公众号开发: 如果需要unionid,需要把公众号绑定到开放平台
 */
'use strict';
const request = new require('request-utils')();
const config  = require('./wechatConfig');
const Cache   = require('cache_utils');

const autoCache = new Cache({
    showUpdateLog: true,
    store        : new Cache.RedisStore(config.cache) //默认内存
});
//公众号唯一标识（企业号corpid即为此appId）
let APPID = config.WECHAT.LOGIN.APPID;
//授权后重定向的回调链接地址，请使用urlEncode对链接进行处理
let REDIRECT_URI = config.WECHAT.LOGIN.REDIRECT_URI;
// 应用授权作用域，
// snsapi_base （不弹出授权页面，直接跳转，只能获取用户openid），
// snsapi_userinfo （弹出授权页面，可通过openid拿到昵称、性别、所在地。并且，即使在未关注的情况下，只要用户授权，也能获取其信息）
let SCOPE = config.WECHAT.LOGIN.SCOPE;
//公众号的appsecret
let SECRET = config.WECHAT.LOGIN.SECRET;

function WechatLogin(opts){

    if(!!opts && !!opts.config){
        APPID = opts.config.WECHAT.LOGIN.APPID;

        REDIRECT_URI = opts.config.WECHAT.LOGIN.REDIRECT_URI;

        SCOPE = opts.config.WECHAT.LOGIN.SCOPE;

        SECRET = opts.config.WECHAT.LOGIN.SECRET;
    }
}

/**
 * 1. 页面请求code,重定向到微信
 * https://open.weixin.qq.com/connect/oauth2/authorize?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&state=STATE#wechat_redirect
 *  用户允许授权后，将会重定向到redirect_uri的网址上，并且带上code和state参数
 *      success:    redirect_uri?code=CODE&state=STATE
 *  若用户禁止授权，则重定向后不会带上code参数，仅会带上state参数
 *      success:    redirect_uri?state=STATE
 */
WechatLogin.prototype.getCode = (req, res)=> {
    let redirect_uri = REDIRECT_URI;
    if (req.params && req.params.role && redirect_uri.indexOf(req.params.role) < 0) {
        redirect_uri += '/' + req.params.role;
    }
    res.redirect('https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + APPID + '&redirect_uri=' + redirect_uri + '&response_type=code&scope=' + SCOPE + '&state=' + Date.now() + '#wechat_redirect');
}


/**
 *2.根据微信回调的code获取access_token 有效时间7200秒(2小时)
 * https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code
 success: {
        "access_token":"ACCESS_TOKEN",
        "expires_in":7200,
        "refresh_token":"REFRESH_TOKEN",
        "openid":"OPENID",
        "scope":"SCOPE",
        "unionid": "o6_bmasdasdsad6_2sgVt7hMZOPfL"
    }
 */

WechatLogin.prototype.getAccessToken = (CODE)=> {
    return new Promise((resolve, reject)=> {
        request.get('https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + APPID + '&secret=' + SECRET + '&code=' + CODE + '&grant_type=authorization_code')
            .then((result)=> {
                if (result.statusCode == 200) {
                    if (result.body.errcode) {
                        console.warn(result.body.errmsg);
                        reject(result.body.errmsg);
                    }
                    else {
                        resolve(result.body);
                    }
                }
                else {
                    console.warn('wechatLogin', 'getAccessToken', 'response.statusCode', result.statusCode);
                    reject(result.statusCode);
                }
            })
            .catch((err)=> {
                console.warn(err);
                reject(err);
            });
    });

};

/**
 * 3.刷新access_token失效30天,期间用户无需再次授权
 *      refresh_token:  如果access_token没有失效则值与access_token一样否则是一个全新新的access_token
 * https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=APPID&grant_type=refresh_token&refresh_token=REFRESH_TOKEN
 success: {
        "access_token":"ACCESS_TOKEN",
        "expires_in":7200,
        "refresh_token":"REFRESH_TOKEN",
        "openid":"OPENID",
        "scope":"SCOPE"
    }
 */

WechatLogin.prototype.refreshAccessToken = (REFRESH_TOKEN)=> {
    return new Promise((resolve, reject)=> {
        request.get('https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=' + APPID + '&grant_type=refresh_token&refresh_token=' + REFRESH_TOKEN)
            .then((result)=> {
                if (result.statusCode == 200) {
                    if (result.body.errcode) {
                        console.warn(result.body.errmsg);
                        reject(result.body.errmsg);
                    }
                    else {
                        resolve(result.body);
                    }
                }
                else {
                    console.warn('refreshAccessToken', 'getAccessToken', 'response.statusCode', result.statusCode);
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
 * 4.检验 授权的凭证access_token,或者refresh_token是否有效
 * https://api.weixin.qq.com/sns/auth?access_token=ACCESS_TOKEN&openid=OPENID
 success:{
        "errcode":0,"errmsg":"ok"
    }
 */
WechatLogin.prototype.checkToken = (ACCESS_TOKEN, OPENID)=> {
    return new Promise((resolve, reject)=> {
        request.get('https://api.weixin.qq.com/sns/auth?access_token=' + ACCESS_TOKEN + '&openid=' + OPENID)
            .then((result)=> {
                if (result.statusCode == 200) {
                    if (result.body.errcode) {
                        console.warn(result.body.errmsg);
                        reject(result.body.errmsg);
                    }
                    else {
                        resolve(result.body);
                    }
                }
                else {
                    console.warn('wechatLogin', 'checkToken', 'response.statusCode', result.statusCode);
                    reject(result.statusCode);
                }
            })
            .catch((err)=> {
                console.warn(err);
                reject(err);
            });
    });
};

/**
 * 5.获取用户的基本信息
 * https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID
 success: {
        "openid":"OPENID",
        "nickname":"NICKNAME",
        "sex":1,
        "province":"PROVINCE",
        "city":"CITY",
        "country":"COUNTRY",
        "headimgurl": "http://wx.qlogo.cn/mmopen/g3MonUZtNHkdmzicIlibx6iaFqAc56vxLSUfpb6n5WKSYVY0ChQKkiaJSgQ1dZuTOgvLLrhJbERQQ4eMsv84eavHiaiceqxibJxCfHe/0",
        "privilege":[
        "PRIVILEGE1",
        "PRIVILEGE2"
        ],
        "unionid": " o6_bmasdasdsad6_2sgVt7hMZOPfL"

    }
 */

WechatLogin.prototype.getUserinfo = (ACCESS_TOKEN, OPENID)=> {
    return new Promise((resolve, reject)=> {
        request.get('https://api.weixin.qq.com/sns/userinfo?access_token=' + ACCESS_TOKEN + '&openid=' + OPENID)
            .then((result)=> {
                if (result.statusCode == 200) {
                    if (result.body.errcode) {
                        console.warn(result.body.errmsg);
                        reject(result.body.errmsg);
                    }
                    else {
                        resolve(result.body);
                    }
                }
                else {
                    console.warn('wechatLogin', 'getUserinfo', 'response.statusCode', result.statusCode);
                    reject(result.statusCode);
                }
            })
            .catch((err)=> {
                console.warn(err);
                reject(err);
            });
    });
}

module.exports = WechatLogin;

/**
 *
 * 1.需要对应的应用/公众号的APPID和SECRET以及手动填写KEY
 * 2.其它设置
 *   2.1 公众号: 需要设置公众号支付支付目录(可以填写用户授权获取code的回调地址);设置界面在【公众平台】中的栏目 【微信支付/开发配置 】里面
 *   2.2 APP:  绑定商户应用宝和应用签名;设置界面在【开放平台】中的栏目【管理中心 / 修改应用 / 修改开发信息】里面
 */

'use strict';
var utils   = require('./index');
var request = require('request');
var config  = require('./wechatConfig');

//公众号的唯一标识（企业号corpid即为此appId）
let APPID = config.WECHAT.PAY.APPID;
//微信支付分配的商户号;【公众平台】->【微信支付】->【商户信息】->查看商户号
let MCHID = config.WECHAT.PAY.MCHID;
//交易类型 注意:交易类型为JSAPI时(即公众号支付)参数'openid'必传(即为需要用户授权认证)
let TRADETYPE = config.WECHAT.PAY.TRADETYPE;
//异步接收微信支付结果通知的回调地址，通知url必须为外网可访问的url，不能携带参数。
let CALLBACKURL = config.WECHAT.PAY.CALLBACKURL;
//微信商户平台(pay.weixin.qq.com)-->账户设置-->API安全-->密钥设置
let KEY = config.WECHAT.PAY.KEY;
//商品简单描述，该字段请按照规范传递
let BODY = config.WECHAT.PAY.BODY;
//时效
let EXPIREDTIME = config.WECHAT.PAY.EXPIREDTIME;


/**
 * 订单有效时间段
 * 标准北京时间，时区为东八区
 * 自1970年1月1日 0点0分0秒以来的秒数
 * 注意毫秒需要转换成秒(10位数字)
 * @returns {string}
 */
function getValidTime() {
    var time = new Date();
    time.setMinutes(time.getMinutes() + EXPIREDTIME, time.getSeconds(), 0);
    var result = {
        start: new Date().format('yyyyMMddhhmmss'),
        end  : time.format('yyyyMMddhhmmss')
    };
    return result;
};


/**
 * 构建统一下单XML参数
 * 参数名ASCII码从小到大排序（字典序）
 * 如果参数的值为空不参与签名；
 * 参数名区分大小写；
 * 签名结果转大写
 * @param args
 * @returns {*}
 */
function getXML(args) {
    args.appid       = APPID;
    args.mch_id      = MCHID;
    args.notify_url  = CALLBACKURL;
    args.trade_type  = TRADETYPE;
    args.body        = BODY;
    args.nonce_str   = utils.randomString(15);
    let validTime    = getValidTime();
    args.time_start  = validTime.start;
    args.time_expire = validTime.end;
    let newArgs      = exports.paySign(args);
    return utils.jsonToXml(newArgs);
}


/**
 * 构造响应给微信的XML结果
 */
function getResult(flag) {
    if (flag) {
        return utils.jsonToXml({
            return_code: {isHide: true, value: 'SUCCESS'},
            return_msg : {isHide: true, value: 'OK'}
        });
    }
    else {
        return utils.jsonToXml({
            return_code: {isHide: true, value: 'FAIL'},
            return_msg : {isHide: true, value: '签名失败'}
        });
    }
}

/**
 * 统一下单
     {
        "return_code":"SUCCESS",
        "return_msg":"OK",
        "appid":"wx1cb441ebe0b96fda",
        "mch_id":"1464292902",
        "nonce_str":"wrDTnuQEfTOeLalJ",
        "sign":"F33C0555D5054121E88B9F90DC5C8C9B",
        "result_code":"SUCCESS",
        "prepay_id":"wx20170523172208bfe41216210661209220",
        "trade_type":"JSAPI"
     }
 */
exports.getOrder = (JSONOpts)=> {
    return new Promise((resolve, reject)=> {
        request({
            url   : 'https://api.mch.weixin.qq.com/pay/unifiedorder',
            method: 'POST',
            body  : getXML(JSONOpts)
        }, (error, response, body) => {
            if (!error && response.statusCode == 200) {

                utils.xmlToJson(body)
                    .then((result)=> {
                        if('FAIL'==result.return_code){
                            reject(result.return_msg);
                        }else{
                            resolve(result);
                        }
                    })
                    .catch((error)=> {
                        reject(error);
                    })
            }
            else {
                console.warn(error);
                reject(error);
            }

        });
    });
}

exports.paySign = (data)=> {
    let keys    = Object.keys(data);
    keys        = keys.sort();
    let newArgs = {};
    keys.forEach(function (key) {
        if ('sign' != key && data[key]) {
            newArgs[key] = data[key];
        }
    });
    let string = '';
    for (var k in newArgs) {
        string += '&' + k + '=' + newArgs[k];
    }

    string += '&key=' + KEY

    string       = string.substr(1);
    let sign     = utils.md5(string);
    newArgs.sign = sign.toUpperCase();
    return newArgs;
}

/**
 * 验证支付结果:
       {
           "appid":"wx1cb441ebe0b96fda",
           "attach":"11d58c48c0334b944727113dfa1cbd65",
           "bank_type":"CFT",
           "cash_fee":"1",
           "fee_type":"CNY",
           "is_subscribe":"Y",
           "mch_id":"1464292902",
           "nonce_str":"T6aB9xMCDA2S5Sc",
           "openid":"oMGlT1b3o9UPbMJB9UvueC74UaFc",
           "out_trade_no":"9497340649008703",
           "result_code":"SUCCESS",
           "return_code":"SUCCESS",
           "sign":"2A5EBBCD30B005B45A4887ACA91E06BB",
           "time_end":"20170523171223",
           "total_fee":"1",
           "trade_type":"JSAPI",
           "transaction_id":"4001462001201705232218238835"
       }
 */
exports.callBack = (req, res)=> {
    return new Promise((resolve, reject)=> {
        //获取REQUEST中BUFFER
        utils.readStream(req, (error, buffer)=> {
            if (!error) {
                utils.xmlToJson(buffer.toString('utf8'))
                    .then((data)=> {
                        //验证签名
                        if (data.sign == exports.paySign(data).sign) {
                            //验证MCHID
                            if (data.mch_id == MCHID) {
                                res.send(getResult(true));
                                resolve(data);
                            }
                            else {
                                res.send(getResult(false));
                                reject({message: 'MCHID_ERROR', data: JSON.stringify(data)});
                            }

                        }
                        else {
                            res.send(getResult(false));
                            reject({message: 'SIGN_ERROR', data: JSON.stringify(data)});
                        }
                    })
                    .catch((error)=> {
                        reject(error);
                    })
            }
            else {
                res.send(getResult(false));
                reject({message: 'PARAM_ERROR'});
            }
        });
    });
}



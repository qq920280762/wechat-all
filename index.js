'use strict';
const login = require('./wechatLogin');
const pay = require('./wechatPay');
const share = require('./wechatShare');
const utils = require('./wechatUtils');
module.exports = {
    login:login,
    pay:pay,
    share:share,
    utils:utils
}
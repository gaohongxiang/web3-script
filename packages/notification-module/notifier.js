import axios from 'axios';
import 'dotenv/config';
import { withRetry } from '../utils-module/retry.js';
import { getCurrentTime } from '../utils-module/utils.js';
/**
 * 发送钉钉通知消息
 * @param {string} content - 要发送的消息内容
 * @param {string} [keyWord='web3消息通知'] - 消息关键词，默认为'web3消息通知'，这个是在添加机器人时设置的。
 * @returns {Promise<Object>} 钉钉 API 的响应结果
 * @throws {Error} 当发送消息失败时抛出错误
 */
export async function dingdingNotifier(content, keyWord = 'web3消息通知') {
    const url = 'https://oapi.dingtalk.com/robot/send?access_token=' + process.env.dingtalkAccessToken;
    const msg = {
        "msgtype": "text",
        "text": { "content": keyWord + '\n' + content + '\n预警时间: ' + getCurrentTime() }
    };

    withRetry(async () => {
        const response = await axios.post(url, msg, {
            headers: { "Content-Type": "application/json;charset=utf-8" },
            timeout: 10000  // 10秒超时
        });
        return response.data;
    }, {
        taskName: '钉钉通知信息发送',
    });
}
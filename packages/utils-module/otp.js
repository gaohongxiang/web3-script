import { authenticator } from 'otplib';

/**
 * 生成一次性密码（OTP）,确保返回的OTP至少还有minRemainingTime秒的有效期，避免时间过短来不及使用。
 * @param {string} otpSecretKey - 用于生成OTP的密钥。
 * @param {number} minRemainingTime - 最小剩余时间（秒），如果密码的剩余有效时间小于等于此时间，则重新生成密码。
 * @returns {Promise<string>} 返回生成的一次性密码。
 */
const MAX_RETRIES = 3;

export async function getOTP(otpSecretKey, minRemainingTime = 3) {

    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
        try {
            const otp = await authenticator.generate(otpSecretKey);
            const remainingTimeInSeconds = authenticator.timeRemaining();
            
            if (remainingTimeInSeconds > minRemainingTime) {
                return otp;
            }

            console.log(`OTP剩余时间不足 ${minRemainingTime} 秒，等待 ${remainingTimeInSeconds + 1} 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, (remainingTimeInSeconds + 1) * 1000));
            retryCount++;
            
        } catch (error) {
            console.error('生成OTP时发生错误:', error);
            throw error;
        }
    }
    
    throw new Error(`无法生成有效的OTP, 已重试 ${MAX_RETRIES} 次`);
}
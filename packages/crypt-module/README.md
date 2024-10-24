# 加解密模块

本模块通过结合1password，用于加解密文本。之所以采用1password，是因为加解密时可以用指纹操作，解锁1password，获取存储的密码，然后执行加解密操作，避免了每次手输密码的繁琐。兼顾安全和便捷。

加解密使用`crypto`库的`aes-256-gcm`算法，使用随机初始化向量，确保数据在传输或存储过程中的唯一性、保密性和完整性。此模式提供了高效的认证和加密，因此被认为是最好的加密模式之一。

> 1password中的密码切不可泄露，否则等于没加密！

### 1password

1、默认你已经熟悉使用1password密码管理器了，客户端需要勾选`设置->开发者->与1Password CLI 集成`选项。如果没有1password，可在此处了解:https://1password.com

2、创建一个密码，复制路径。

3、将路径添加到`.env`配置文件中 `personalToken = 'op://路径`

### 使用示例

1、加解密文本

```
import { enCryptText, deCryptText, enCryptColumn, deCryptColumn } from './packages/crypt-module/crypt.js';

const text = 'hello web3';
// 加密(相同文本每次加密结果也不同)
const enText = await enCryptText(text);
console.log(enText);
//解密
const text = await deCryptText(enText);
console.log(text);
```

2、加密某列文本

假设有一个`wallet.csv`文件，存放地址、私钥等信息，很显然，私钥不能明文存储。这个时候就需要给私钥这一列数据加密
```
id,address,enPrivateKey
1,bc1p0xlw9r7f63m5k4q8z8v49q35t9q0,L1k3wqhiuguv1Ki3pLnuiybr0vm
2,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,Pkmnuhfh7hbidcuin8877g2b1ns
3,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,Pkmnuhfh7hbidcuin8877g2b1ns
...
```

执行加密操作
```
await enCryptColumn('./crypt_module/wallet.csv', 'enPrivateKey');
```

加密过后，`wallet.csv`文件内容如下。
```
id,address,enPrivateKey
1,bc1p0xlw9r7f63m5k4q8z8v49q35t9q0,6f74035f8943b525741079695031c2aad826a013e4534dd132fa3852a72ec91bb37156e4a2775792ba1bc66186546bb5f188618614b858
2,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,a7002ad8dfd7451fe1f53579b87900917a901e84215c579534814e36f749d7dfaff4d9550a7bbde77832a7db4bc0fae7cb53db1b5ebf1c
3,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,4eba6f49beeed4ac67fc41e60072a887e1ebfc4044618d84ad09e6d558bcc11fdb11025bc488b070979730bf6fa4635bb7e36fc0903fc0
...
```

>tips：通过第2、3条enPrivateKey数据可知，就算相同的数据加密出来也是不一样的，提高安全性。

目前大的应用场景就是使用`enCryptColumn`批量加密钱包文件的私钥、助记词等字段，安全存储。使用的时候用到哪个就用`deCryptText`解密。

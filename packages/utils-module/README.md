常用的工具函数。

1、安装库

```
npm install ghx-utils-module
```

2、使用
```
import { getCsvData, sleep, randomWait } from 'ghx-utils-module'

// 获取csv文件数据，路径根据自己实际情况修改
const data = await getCsvData('./wallet.csv')
console.log(data)

// 暂停5秒
await sleep(5)

// 随机等待5到10秒之间的时间
await randomWait(5,10)
```
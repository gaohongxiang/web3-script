# 通知/日志模块

## 钉钉机器人通知

### 1. 创建钉钉群

1. 点击左上角 "+" 号
2. 选择"发起群聊"
3. 输入群名称（如：Web3 通知群）
4. 点击"创建"完成群创建

### 2. 创建钉钉机器人（需要电脑端）

1. 在已创建的群聊中，点击群设置（右上角）
2. 选择"智能群助手"
3. 点击"添加机器人"
4. 选择"自定义"机器人
5. 机器人名字随意设置（如：Web3 通知助手）
6. 安全设置选择以下任一方式：
    - 方式一：选择"自定义关键词"，填写消息中必须包含的关键词（我用的此方式，关键词为：web3消息通知）
    - 方式二：选择"加签"（更安全） 
7. 点击"完成"，复制生成的 Webhook 地址
8. 从 Webhook 地址中提取 access_token（https://oapi.dingtalk.com/robot/send?access_token=xxx 中的 xxx 部分）

### 3. 配置文件

.env文件添加
```
# 钉钉机器人access_token
dingtalkAccessToken = 'XXXXXX'
```

### 使用示例

```javascript
import { dingdingNotifier } from './notifier.js';

// 发送消息
await dingdingNotifier('测试消息', 'web3消息通知'); // 如果你设置的关键词为：web3消息通知，则可以忽略此参数
```

### 官方文档
- https://open.dingtalk.com/document/robots/custom-robot-access
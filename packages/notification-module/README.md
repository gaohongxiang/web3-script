# 通知/日志模块

1. 通知管理器 - 用于控制台输出和文件日志记录
2. 钉钉机器人 - 用于发送消息到钉钉群

## 通知管理器 (NotificationManager)

通知管理器用于统一管理系统中的消息提示，支持控制台输出和文件日志记录。

### 基本用法

```javascript
import { notificationManager } from './notification.js';

// 1. 简单消息（无上下文）
notificationManager.info('这是一条普通信息');
notificationManager.success('这是一条成功信息');  // 绿色显示
notificationManager.warning('这是一条警告信息');  // 黄色显示
notificationManager.error('这是一条错误信息');    // 红色显示

// 2. 带上下文的对象形式（推荐）
notificationManager.info({
  message: '代理服务器启动',
  context: { module: 'proxy', id: 1 }
});
// 输出: 代理服务器启动 [module proxy] [id 1]

// 3. 仅显示上下文（message为空）
notificationManager.info({
  context: { module: 'proxy', status: 'running' }
});
// 输出: [module proxy] [status running]

// 4. 带上下文的链式调用
notificationManager
  .withContext({ module: 'proxy', id: 1 })
  .success('代理服务器启动');
// 输出: 代理服务器启动 [module proxy] [id 1]

// 5. 完整对象形式
notificationManager.notify({
  message: '代理服务器启动',  // message 可以为空
  type: 'SUCCESS',  // 可选，默认 'INFO'
  context: { module: 'proxy', id: 1 }  // 可选
});
// 输出: 代理服务器启动 [module proxy] [id 1]

// 4. 持久化上下文
notificationManager.withContext({ module: 'proxy' });
notificationManager.info('开始初始化');  // [module proxy] 开始初始化
notificationManager.success('初始化完成');  // [module proxy] 初始化完成
notificationManager.clearContext();  // 清除上下文
```

### 配置选项

通过 `configure` 方法可以自定义全局配置：

```javascript
notificationManager.configure({
    showTimestamp: true,     // 是否显示时间戳，默认 true
    logToConsole: true,      // 是否在控制台打印，默认 true
    logToFile: true,         // 是否写入日志文件，默认 true
    logDir: 'logs',          // 日志目录，默认 'logs'
    logRetentionDays: 7,     // 日志保留天数，默认 7 天
    contextFirst: false      // 控制上下文和消息的顺序，false 表示消息在前，true 表示上下文在前
});
```

所有配置项都是可选的，只需要传入你想修改的选项。

### 消息级别配置

除了全局配置外，还支持针对单条消息的配置，可以覆盖全局配置：

```javascript
// 示例1：只写入日志，不在控制台显示
notificationManager.info({
  message: "后台任务执行成功",
  context: { taskId: "123" },
  config: {
    logToConsole: false,  // 覆盖全局配置，不在控制台显示
    logToFile: true      // 写入日志文件
  }
});

// 示例2：只在控制台显示，不写入日志
notificationManager.success({
  message: "临时调试信息",
  config: {
    logToConsole: true,   // 在控制台显示
    logToFile: false      // 不写入日志文件
  }
});

// 示例3：完全自定义配置
notificationManager.info({
  message: "自定义显示的消息",
  context: { module: "test" },
  config: {
    showTimestamp: false,   // 不显示时间戳
    logToConsole: true,     // 在控制台显示
    logToFile: true,        // 写入日志文件
    contextFirst: true      // 上下文显示在消息前面
  }
});
```

消息级别配置的优先级高于全局配置，但仅对当前消息有效。未指定的配置项会使用全局配置。

#### 常见配置场景

1. 修改消息顺序：
```javascript
// 消息在前（默认）
notificationManager.configure({ contextFirst: false });
// 输出: 代理服务器启动 [module proxy] [id 1]

// 上下文在前
notificationManager.configure({ contextFirst: true });
// 输出: [module proxy] [id 1] 代理服务器启动
```

2. 修改日志目录：
```javascript
notificationManager.configure({
    logDir: 'logs/proxy'  // 日志将保存在 logs/proxy 目录
});
```

3. 禁用控制台输出：
```javascript
notificationManager.configure({
    logToConsole: false  // 只写入文件，不在控制台显示
});
```

4. 禁用文件日志：
```javascript
notificationManager.configure({
    logToFile: false  // 只在控制台显示，不写入文件
});
```

4. 禁用时间戳：
```javascript
notificationManager.configure({
    showTimestamp: false  // 消息前不显示时间戳
});
```

### 上下文管理

上下文用于为消息添加额外的标识信息，支持三种级别的上下文：

1. 全局上下文（通过setGlobalContext设置）
```javascript
// 设置全局上下文，适用于整个应用生命周期
notificationManager.setGlobalContext({
  module: 'proxy',
  version: '1.0'
});
```

2. 持久上下文（通过withContext设置）
```javascript
// 设置持久上下文
notificationManager.withContext({ module: 'proxy' });

// 后续所有消息都会带上这个上下文，直到被清除
notificationManager.info('开始初始化');  // [module proxy] 开始初始化
notificationManager.success('初始化完成');  // [module proxy] 初始化完成

// 需要手动清除持久上下文
notificationManager.clearContext();
```

3. 临时上下文（仅对当前消息有效）
```javascript
// 方式1：链式调用
notificationManager
  .withContext({ id: 1 })
  .info('服务启动');  // 消息发送后自动清除上下文

// 方式2：消息对象中指定
notificationManager.info({
  message: '服务启动',
  context: { id: 1 }
});

// 两种方式效果完全相同，都是一次性的
```

上下文优先级：临时上下文 > 持久上下文 > 全局上下文

示例：
```javascript
// 1. 设置全局上下文
notificationManager.setGlobalContext({
  module: 'proxy',
  env: 'prod'
});

// 2. 设置持久上下文
notificationManager.withContext({ status: 'running' });

// 3. 使用临时上下文（会覆盖同名的持久上下文和全局上下文）
notificationManager.info({
  message: '配置更新',
  context: {
    env: 'test',    // 覆盖全局上下文中的 env
    status: 'idle'  // 覆盖持久上下文中的 status
  }
});
// 输出: 配置更新 [module proxy] [env test] [status idle]

// 持久上下文仍然存在
notificationManager.info('继续检查');  // [module proxy] [env prod] [status running]

// 清除持久上下文
notificationManager.clearContext();
```

### 日志文件

- 日志文件按天生成，文件名格式：`YYYY-MM-DD.log`
- 日志内容格式：`[时间戳] [类型] [上下文] 消息内容`
- 默认保留最近7天的日志文件
- 使用北京时间（UTC+8）

#### 日志示例

```
[2024-03-21_14:30:45] [INFO] 代理服务器启动 [module proxy] [id 1]
[2024-03-21_14:30:46] [SUCCESS] 初始化完成
[2024-03-21_14:30:47] [WARNING] 连接超时
[2024-03-21_14:30:48] [ERROR] 服务异常
```

### 日志清理

系统会自动清理过期的日志文件（默认7天），也可以手动清理：

```javascript
notificationManager.cleanLogs();  // 清理过期日志文件
```

### 注意事项

1. 消息会立即在控制台显示，日志文件异步写入
2. 日志目录会自动创建，无需手动创建
3. 如果写入日志失败，会在控制台输出错误信息，但不会影响程序运行
4. 建议在程序启动时进行一次配置，之后使用默认配置
5. 控制台彩色输出在某些终端可能不支持
6. 临时上下文在消息发送后会自动清除
7. 持久化上下文需要手动调用 clearContext() 清除

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
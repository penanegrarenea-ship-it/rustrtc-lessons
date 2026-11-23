# 0018 云端验证

验证地点是云端 Linux，不是 Windows，也不是教学共享电脑。没有把源码推演写成运行结果。成功截图没有取到：Chrome 的 `Page.captureScreenshot` 超时，本目录不附带旧图。

## 环境

| 项 | 值 |
| --- | --- |
| 操作系统 | Linux 6.12.113+ x86_64 |
| rustc | 1.100.0 (0ef1bc386 2026-11-09) |
| cargo | 1.100.0 (3acc79c0c 2026-11-05) |
| Chrome | 157.0.8103.50 |
| 上游 | `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`，只改两个示例文件 |
| 构建 | 在 `/tmp/rustrtc` 执行 `cargo build --example datachannel_chat`，退出码 0。库原有 3 条 deprecation warning，没有改库 |
| 启动 | 工作目录 `/tmp/rustrtc`，二进制监听 `http://127.0.0.1:3000/` |
| 根页面 | 启动后读取 `/`，正文含「本地已提交，尚无对端确认」。这是重编译后嵌入的页面，不是旧二进制 |
| 时间 | 下表由日志 UTC 换算为 JST（UTC+9）。成功那一轮监听时刻是 2026-11-24 02:35:20.922 JST |

## 五项结果

五组都在同一进程、真实 Chrome 两个页面上通过。随后又跑了一轮没有暂停注入的双向聊天，也通过。页面文字里的 UUID 已换成 `[uuid]`；服务端日志里的同一编号换成 `id-1` 这种标签，相同标签表示同一个编号。原文见 `validation-server.log` 和 `validation-browser.json`。

1. 双向 ACK：通过。Alice 的 `hello-from-alice` 被 Bob 显示后，Alice 那一行变成「收到Bob应用确认」。Bob 的 `hello-from-bob` 独立变成「收到Alice应用确认」。两边各发送 1 次 chat 和 1 次 ack。日志：client 1 转发 chat `id-1`，client 2 转发 ack `id-1` receiver Bob；client 2 转发 chat `id-2`，client 1 转发 ack `id-2` receiver Alice。

2. 同文不同编号：通过。Alice 连发两条正文都是 `same-body`。两条编号不同。先只放行第一条的 ACK 时，第一行已是「收到Bob应用确认」，第二行仍是「本地已提交，尚无对端确认」。再放行第二条后，两行各自确认。日志是 client 3 的 `id-3`、`id-4`，client 4 随后分别转发这两条 ack。

3. 暂停 ACK：通过。暂停只包在测试脚本的 `DataChannel.send` 上，页面没有新按钮，通道保持打开。Bob 已经显示 `Alice: pause-check（id=...）`，此时 Bob 侧暂存了 1 条 ack，Alice 仍是「尚无对端确认」。放行后 Alice 才变成「收到Bob应用确认」。日志上 chat `id-5` 在 02:35:23.036 JST 转发，对应 ack 在 02:35:23.550 JST 才转发，中间没有由 Rust 在收到 chat 时写 ack。

4. 重复和未知 ACK：通过。正常确认之后，测试脚本又从 Bob 的通道送出同一编号的第二份 ack，以及 `unknown-id-not-pending`。Alice 的 Me 行仍只有一行，且仍是原来的确认，页面没有出现未知编号。Alice 的 ack 发送数保持 0，没有回环。Alice 的 ack 接收数从 1 增到 3。Bob 的 ack 发送数从 1 增到 3，Bob 的 ack 接收数保持 0。日志里 client 8 对 `id-6` 转发了两次，并转发了 `unknown-id-not-pending`。

5. 断开并新开会话：通过。Alice 有一条未确认的 `pending-left` 时断开。该行仍是「本地已提交，尚无对端确认」，没有被改成「对端未收到」。重新 Connect 后发送 `after-reconnect`，编号不同。放行暂存的 ack 后，旧行保持未确认，新行变成「收到Bob应用确认」。日志：client 9 转发 `id-7` 后通道关闭；client 11 是新会话并转发 `id-8`；随后两条 ack 都由 client 10 转发，旧编号不再改写旧行。

正式页面复测：通过。没有暂停注入时，`final-a` 与 `final-b` 各自得到对方应用确认。日志是 client 12 / 13 的 `id-9` 与 `id-10`。

## 行号

下面是本目录两个完整文件里的应用协议，不是上游原例。行号按这两个文件的当前内容计。

- 客户端 chat 增加 id、新增 ack：`examples/datachannel_chat.rs` 74–99
- 转发 chat 与 ack：`examples/datachannel_chat.rs` 160–196
- 待确认表与本地行：`examples/static/chat.html` 57–73
- 追加文字后再发 ack，以及按 id 更新原行：`examples/static/chat.html` 158–180
- 断开清空待确认表：`examples/static/chat.html` 125–145
- 发送页生成编号：`examples/static/chat.html` 200–221

原例仍在上游 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`，没有这些字段：

- 原消息枚举：<https://github.com/restsend/rustrtc/blob/f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa/examples/datachannel_chat.rs#L74-L90>
- 原转发与 chat 广播：<https://github.com/restsend/rustrtc/blob/f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa/examples/datachannel_chat.rs#L117-L174>
- 原页面发送与接收：<https://github.com/restsend/rustrtc/blob/f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa/examples/static/chat.html#L148-L179>
- 原按钮：<https://github.com/restsend/rustrtc/blob/f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa/examples/static/chat.html#L44-L46>

## 没有验证的事

没有在 Windows 上执行。没有跨公网、第三个页面、音频、鉴权、持久化或自动重试。没有成功截图。ACK 的通过记录只说明两个协作页面上的应用层确认，不是已读回执，不是身份认证，也不是 SCTP 确认。

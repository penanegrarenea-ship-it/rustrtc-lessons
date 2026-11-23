# 0018 练习：聊天消息编号与应用层接收确认

这是给后续第 18 课用的可运行练习，不是上游 rustrtc 的改动，也不是生产聊天系统。只改原示例的两个应用文件。HTTP offer/answer、等候选收集完成、negotiated `chat` / id 0、登录、名字来源、按连接过滤的广播、`127.0.0.1:3000`、按钮 Connect / Send / Disconnect 都保留。

固定上游：`f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。

本练习只按同一服务上的两个协作页面验收。不要用第三个页面参加同一轮。多开页面会让确认来源变成另一个已登记名字，不在验收里。

这里的 ACK 是接收页把文字追加到页面之后，再发回的应用层确认。它不是已读回执，不是身份认证，不是 SCTP 传输确认，也不是 DCEP `DATA_CHANNEL_ACK`。

## 新增的应用约定

编号由发送页用 `crypto.randomUUID()` 生成。匹配只看完整编号，不看正文。

| 方向 | JSON |
| --- | --- |
| 浏览器到 Rust 的 chat | `{"type":"chat","id":"...","content":"..."}` |
| Rust 转到另一页的 chat | `{"type":"chat","id":"...","sender":"已登记名字","content":"..."}` |
| 接收页追加文字后发给 Rust 的 ack | `{"type":"ack","id":"..."}` |
| Rust 转到原发送页的 ack | `{"type":"ack","id":"...","receiver":"接收页已登记名字"}` |

Rust 收到 chat 只转发 chat，不自己生成 ack。收到 ack 才用该连接已登记的名字填 `receiver` 并转发。原有的 `sender_id` 过滤继续排除发送连接自己。login 和 system 没有 ack。

接收页先把 `sender: content（id=...）` 写入页面，再发送 ack。发送页先显示「本地已提交，尚无对端确认」，只有编号相同的 ack 才把那一行改成「收到某应用确认」。未知编号和重复 ack 不新增行，也不再发 ack。断开时清空待确认表，已有文字保持原样，不改成「对端未收到」，重连后的新编号不沿用旧表。

## 文件

- `examples/datachannel_chat.rs`、`examples/static/chat.html`：相对固定上游改过的完整文件。放到上游仓库同名路径后才能编译。
- `0018-against-f1b59bf6.patch`：只含这两个文件，可在干净的该提交上 `git apply`。
- `0018-chat-message-ack.zip`：上述源码、补丁、说明、测试和脱敏验证的下载包，不含构建产物。
- `test/two-page.mjs`：云端 Chrome 双页脚本。暂停 ACK 只存在于这个脚本对 `DataChannel.send` 的包裹，页面上没有新增按钮。
- `VALIDATION.md`、`validation-server.log`、`validation-browser.json`：脱敏后的实际结果。

## 在固定上游上运行

根页面由 `include_str!` 在编译时嵌入。改 HTML 或打上补丁之后，必须重新编译再启动，否则浏览器拿到的仍是旧页面。

下面的 Linux 命令是云端在新建目录 `/tmp/rustrtc` 里实际用过的形式。不要在已有工程里执行 `git checkout` 或 `git apply`，那会改动当前工作区。

```bash
git checkout --detach f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa
git apply /path/to/0018-against-f1b59bf6.patch
cargo build --example datachannel_chat
cargo run --example datachannel_chat
```

浏览器打开 `http://127.0.0.1:3000/`。只用两个页面，分别 Connect 为 Alice 和 Bob，再 Send。

### Windows 11 PowerShell

下面没有在 Windows 上执行过。它要求一份新目录里的克隆，确认提交后再打补丁。目录已存在就停止，不要重置或覆盖已有工程。`cargo run` 会重新编译，从而把补丁后的页面嵌进二进制。

```powershell
$dest = Join-Path $env:USERPROFILE "rustrtc-0018-ack"
if (Test-Path $dest) { throw "目录已存在。换一个新目录，不要覆盖已有工程。" }
git clone https://github.com/restsend/rustrtc.git $dest
Set-Location $dest
git checkout --detach f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa
if ((git rev-parse HEAD) -ne "f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa") {
    throw "不是固定提交，已停止。"
}
git apply C:\path\to\0018-against-f1b59bf6.patch
cargo run --example datachannel_chat
```

然后打开 `http://127.0.0.1:3000/` 的两个页面。

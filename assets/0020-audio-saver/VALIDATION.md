# 0020 音频接收（audio_saver）：脱敏验证摘要

验证日期 2026-11-27，所有时刻为 Asia/Tokyo（JST）。上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。本轮未改库、依赖或示例，也没有给上游开 PR。此文件是实际验证材料的字段摘录，不是用户本机结果，也不是试听或性能报告。

## 环境和路径

- 通过的是云端 Linux 虚拟机，不是教学共享电脑，也不是用户的 Windows。操作系统 Ubuntu 24.04.5 LTS，kernel 6.12.113+。
- rustc 1.100.0 (0ef1bc386 2026-11-09)，cargo 1.100.0 (3acc79c0c 2026-11-05)，显式使用 `+1.100.0`。此提交 `edition = "2024"`。
- 在仓库根目录执行 `cargo +1.100.0 build --example audio_saver` 退出码为 0。保留原库三条 `fetch_update` 弃用警告，不是本课改了依赖。运行后 HEAD 仍是上述固定提交。
- 服务在 2026-11-27 02:45:10.344068 JST 开始监听 `http://127.0.0.1:3000`。
- Chrome 157.0.8103.50。使用 `--use-fake-device-for-media-stream`、`--use-fake-ui-for-media-stream`，以及一个生成的 20 秒、48 kHz、单声道、440 Hz 正弦波 WAV 作为伪造采集。这是合成麦克风，不是真人耳测，本轮没有对保存文件解码或播放。
- 打开的是根路径 `http://127.0.0.1:3000/`，标题 RustRTC Audio Saver，按钮为 Start Recording 和 Stop。采集是 `getUserMedia({ audio: true, video: false })`。请求体只有 `{ sdp }`。
- 同一 3000 端口不能与 `echo_server` 或 `datachannel_chat` 同时占用。
- 另有一次教学电脑上的 Chrome 因 WebRTC 回环策略未能完成 ICE（ICE 仍为 new，`output.ulaw` 为 0 字节）。那次不能当成接收成功。本课采用的通过记录只来自上述云端 Linux 虚拟机。

## 实际结果

页面状态文案变成 `Status: connected`（页面脚本会加上 `Status: ` 前缀）。截图拍摄于 2026-11-27 02:47:39.988 JST，当时 Start Recording 禁用、Stop 启用。点 Stop 后状态为 `Status: Stopped`。

服务端日志（UTC 原样换算为 JST）：

- `ICE State changed: Connected` 出现在 02:47:25.122064 JST。
- 紧接着 `Received first audio packet: 105 bytes, PT: Some(111)`，时间为 2026-11-27 02:47:25.154334 JST。
- 点 Stop 后 `Audio recording stopped. Total packets: 744`，时间为 02:47:40.012194 JST。

offer 与 answer 都有 `a=rtpmap:111 opus/48000/2` 和 `a=fmtp:111 minptime=10;useinbandfec=1`，方向都是 `a=sendrecv`。answer 的 m 行还列出 PCMU 0。getStats 的 codec 为 `audio/opus`、payloadType 111、clockRate 48000。本轮真正发送并首次收到的是 PT 111。

浏览器 `getStats` 两次快照（02:47:34.933 与 02:47:39.945 JST，统计时间戳相隔 5012.344 ms）中：

- transport 的 `iceState` 与 `dtlsState` 均为 `connected`。
- 选中候选对是 nominated、succeeded 的 host UDP：`172.30.0.2:59160` → `172.30.0.2:46825`。这是该云端虚拟机当次选中的主机地址，不是跨公网保证。
- 上行音频 SSRC 489390201 的 `packetsSent` / `bytesSent` 从 490 包 / 39581 字节增到 740 包 / 59831 字节。
- 两份报告里都没有 `inbound-rtp`。`media-playout` 的 `totalSamplesCount` 与 `totalSamplesDuration` 均为 0。这是预期现象：本示例不回送、也不在页面上播放远端音频轨道。缺少 inbound 不能当成失败，也不能写成远端已播放。
- 服务端没有成功 DTLS 握手日志，没有补造。浏览器 transport 记录了 `dtlsCipher` 为 `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`，`srtpCipher` 为 `SRTP_AES128_CM_HMAC_SHA1_80`。

`output.ulaw` 最终 60155 字节，sha256 为 `4d9cc1e5e8a75e8b226f7dd34a1d4bcf3437537d497b1d717d0a7d582d6f72e1`。示例把 `frame.data` 原样写入这个文件名。因为本轮 PT 是 111，文件是 Opus 负载，不是合法的 μ-law。页面上的 `ffplay -f mulaw -ar 8000` 命令对本轮不适用。本轮没有解码或播放该文件。

服务端结束时的 744 与 t2 上行 `packetsSent` 740 都来自同一次会话；t2 采样略早于停止日志。这里不把相差的 4 归因到具体的包。

页面没有配置 STUN；HTTP 打开的是 `127.0.0.1:3000`，但选中的媒体路径是主机 UDP，不是环回地址。HTTP 能打开页面，不能证明 ICE 走环回。

## 文件与脚本

- `session-stats.json` 是实际脱敏记录的字段白名单副本，只保留本课所需的连接状态、transport、选中候选对、上行音频 RTP、codec 和 playout 计数，不含完整 SDP、ICE 凭证、指纹或未选中候选。
- `sdp-excerpts.md` 是脱敏截取，含不可部署的 `[port]` 标记，不是完整 SDP。
- `page-getstats.js` 记录云端真实执行的表达式。先在点击 Start Recording 之前执行构造函数包装，再在点击之后执行采样部分，不能一次运行整个文件。原页面没有 `window.pc`。
- `session-connected.png` 是本轮在 `Status: connected` 时拍摄的页面截图，不是生成图。

## 未验证

未测 Windows、真人麦克风、把文件当 μ-law 或 Opus 来播放、音频回声、跨公网穿透或性能。没有做 RecvOnly 对照实验，因此 `set_direction(SendRecv)` 只保留示例作者的 workaround 说明，不能写成已证实根因。

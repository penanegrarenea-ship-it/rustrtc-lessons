# 0024 sip()+Keying::Dtls 协商：脱敏验证摘要

验证日期 2026-11-28，所有时刻为 Asia/Tokyo（JST）。上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。本轮未改库、依赖或官方示例/测试，也没有给上游开 PR。此文件是实际验证材料的字段摘录，不是用户本机结果，也不是真实话机收包或 Windows 成功记录。DTLS 证书私钥、`a=crypto` 的 inline 密钥和 `ice-pwd` 真值不在本文件中出现。指纹是 SDP 里的公开材料，下面只记录本轮真实跑出的值。

## 环境和命令

- 通过运行发生在 Linux 教学电脑：Debian GNU/Linux 13（trixie），kernel 6.12.113+。不是用户的 Windows。
- rustc 1.100.0 (0ef1bc386 2026-11-09)，cargo 1.100.0 (3acc79c0c 2026-11-05)，显式使用 `+1.100.0`。此提交 `edition = "2024"`。
- 在固定提交的仓库根目录执行：
  - 主路径：`cargo +1.100.0 test --test connectivity_keying -- --nocapture --test-threads=1 --exact sdp_dtls`
  - 对照：同样命令，过滤器分别为 `--exact sdp_none`、`--exact sdp_sdes`
  - 选路对照（可选，不是本课主路径）：`--exact ice_lite_dtls`、`--exact ice_dtls`
- rustc 1.100.0 的测试过滤器按子串匹配。不要把 `|` 写成“或”。本课给这些测试都加上 `--exact`，并且没有跑完九格组合。运行后 HEAD 仍是上述固定提交。工作树保持干净，未改共享克隆（仍在 e13b5f2）。
- 编译保留原库三条 `fetch_update` 弃用警告，不是本课改了依赖。

## 官方集成测试本轮结果（2026-11-28）

主路径 `sdp_dtls` 于 12:32:02 JST 开始，12:32:50 JST 结束，退出码 0。`Finished test profile` 约 47.87 秒（本轮第一次编译集成测试二进制），测试本身 0.03 秒，1 passed，20 filtered out。stdout 没有打印指纹、`a=crypto` 密钥或 `ice-pwd`。

必须标明：官方 `config()`（`tests/connectivity_keying.rs` 20–37行）是从 `RtcConfiguration::webrtc()` 起步，再覆盖 `connectivity`、`keying`、`webrtc_extensions = false`、`bind_ips` 与 `media_capabilities`，不是从 `sip()` 起步。`sdp_dtls` 经 `call()` 调用 `check_description`：协议为 `UDP/TLS/RTP/SAVPF`，有 `a=fingerprint:`，无 `a=crypto:`；`a=ice-ufrag:` 仅当 connectivity 不是 `Sdp`，`a=ice-lite` 仅 `IceLite`。该测试是两个本地 `PeerConnection` 在回环上协商并双向送媒体，不是话机，不是公网。

对照于 12:32:57–12:32:58 JST 以 `--exact` 执行，退出码均为 0：

- `sdp_none`：`Finished` 约 0.31 秒，测试本身 0.01 秒。Sdp × None，协议 `RTP/AVP`，无指纹、无 crypto、无 ICE 属性。
- `sdp_sdes`：`Finished` 约 0.16 秒，测试本身 0.01 秒。Sdp × Sdes，协议 `RTP/SAVP`，有 `a=crypto`，无指纹、无 ICE 属性。

选路对照同样在 12:32:58 JST 以 `--exact` 执行，退出码均为 0，必须写成选路不同的对照，不是本课主路径：

- `ice_lite_dtls`：`Finished` 约 0.14 秒，测试本身 0.03 秒。IceLite × Dtls。
- `ice_dtls`：`Finished` 约 0.16 秒，测试本身 0.02 秒。Ice × Dtls。

这两组 stdout 同样没有打印指纹或密钥。它们也从 `webrtc()` 覆盖字段，不是从 `sip()` 起步。未跑其余格子。

这些测试全部通过，只证明协商字段，以及（仅限这些回环测试）两个本地连接能互发媒体，不能证明已经从话机收到 SRTP 音频。

## 诊断程序（不是官方测试，不要求学生运行）

为观察官方测试通过时并不打印的 SDP 形状，另写了一个不发表的诊断程序：对 `RtcConfiguration::sip()` 只改 `keying = Keying::Dtls`，再走 `create_offer` / `create_answer`。这才是课文要教的 API。证书与指纹在运行时生成，不使用夹具私钥，程序也不打印私钥。2026-11-28 12:33:09–12:33:42 JST，`Finished dev profile` 约 32.21 秒，墙钟约 33 秒，退出码 0。HEAD 仍是固定提交。

脱敏后的要点：

- 从 `sip()` 只改 `Keying::Dtls` 的 offer：协议为 `UDP/TLS/RTP/SAVPF`；媒体级 `a=fingerprint:sha-256 95:F3:F8:4E:54:E6:8F:1C:35:A8:9B:B3:0A:E2:86:64:B2:90:74:4A:B9:04:26:6B:D7:DF:18:8C:AB:52:96:66` 与 `a=setup:actpass`；有 `a=rtcp-mux` 与 `a=rtcp:`；没有 `a=crypto`，没有 ICE 属性（无 `ice-ufrag` / `ice-pwd` / `candidate` / `ice-lite`）。列出的格式是默认 Opus PT 111。
- 对上述 offer 做 `create_answer`：协议同样是 `UDP/TLS/RTP/SAVPF`；媒体级写出同一指纹与 `a=setup:passive`；有 `a=rtcp-mux`，没有 `a=rtcp:`；没有 `a=crypto`，没有 ICE 属性。答案列出的也是 Opus PT 111，与 offer 交集一致。同一进程里两个 `PeerConnection` 调用的 `generate_certificate` 会缓存并复用同一张证书，所以本轮 offer 与 answer 的指纹相同。这不是从对端抄来的指纹，也不等于两台机器会共用证书。
- 对照：默认 `sip()` 的 offer 协议为 `RTP/AVP`，无指纹、无 setup、无 crypto、无 ICE 属性。`sip()` 只改 `Keying::Sdes` 的 offer 协议为 `RTP/SAVP`，有媒体级 `a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>|2^31`，无指纹、无 setup、无 ICE 属性。

地址、端口、会话标识和 SSRC 已删除。完整未脱敏 SDP 与任何私钥只留在非公开验证目录，不进入公开材料。这不是官方测试的 stdout，也不能证明已经收到媒体。

## 未测范围

Windows、真实话机、公网，以及 Connectivity × Keying 的其余格子，均未在本轮验收。不要把覆盖写成掌握。

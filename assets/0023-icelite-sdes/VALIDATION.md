# 0023 sip()+IceLite+Sdes 协商：脱敏验证摘要

验证日期 2026-11-27，所有时刻为 Asia/Tokyo（JST）。上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。本轮未改库、依赖或官方示例/测试，也没有给上游开 PR。此文件是实际验证材料的字段摘录，不是用户本机结果，也不是真实话机收包、Linphone 或 Windows 成功记录。`a=crypto` 的 inline 密钥和 `ice-pwd` 已删除，不在本文件中出现。

## 环境和命令

- 通过运行发生在 Linux 教学电脑：Debian GNU/Linux 13（trixie），kernel 6.12.113+。不是用户的 Windows。
- rustc 1.100.0 (0ef1bc386 2026-11-09)，cargo 1.100.0 (3acc79c0c 2026-11-05)，显式使用 `+1.100.0`。此提交 `edition = "2024"`。
- 在固定提交的仓库根目录执行：
  - `cargo +1.100.0 test --lib -- --nocapture --test-threads=1 srtp_mode_ice_lite_answer_has_ice_attributes`
  - `cargo +1.100.0 test --lib -- --nocapture --test-threads=1 rtp_mode_ice_lite_sdp_attributes`
  - 可选：`cargo +1.100.0 test --test connectivity_keying -- --nocapture --test-threads=1 --exact ice_lite_sdes`
- rustc 1.100.0 的测试过滤器按子串匹配。不要把 `|` 写成“或”。过滤器 `ice_lite_sdes` 若不用 `--exact`，还会匹配到 `ice_offers_to_ice_lite_sdes`。本课因此给可选测试加上 `--exact`，并且没有跑九格组合。运行后 HEAD 仍是上述固定提交。工作树保持干净，未改共享克隆（仍在 e13b5f2）。
- 编译保留原库三条 `fetch_update` 弃用警告，不是本课改了依赖。

## 官方库测试本轮结果（2026-11-27）

主路径与对照于 19:43:51 JST 开始，19:43:52 JST 结束，两组退出码均为 0。测试二进制此前已经编过：`Finished test profile` 分别约为 0.48、0.17 秒；测试本身分别 0.01、0.02 秒。在全新克隆上第一次编译会更久。stdout 没有打印 ICE 口令或 `a=crypto` 密钥。

通过的库测试：

- `srtp_mode_ice_lite_answer_has_ice_attributes`（配方3主路径）：对一份 RTP/SAVP、带 `a=crypto` 与 ICE 凭证/候选、但没有 `a=ice-lite` 的远程 offer，本端 `sip()` + `Connectivity::IceLite` + `Keying::Sdes` 的 answer 含 `a=ice-lite`、`a=ice-ufrag:`、`a=ice-pwd:`、`a=candidate:`、`a=crypto:`，且 ICE 角色为 `Controlled`。该测试不断言 `m=` 协议或载荷类型。本课不转载测试夹具里的密钥和口令。
- `rtp_mode_ice_lite_sdp_attributes`（对照，IceLite+None）：`sip()` 只改 `connectivity = IceLite` 后，`create_offer` 含 `a=ice-lite`、`a=ice-ufrag:`、`a=ice-pwd:`、`a=candidate:`，协议为 RTP/AVP，无指纹。

可选集成测试 `ice_lite_sdes` 于 19:44:49–19:44:52 JST 以 `--exact` 执行，退出码 0。`Finished test profile` 约 3.30 秒（编了 `tests/connectivity_keying.rs` 测试二进制），测试本身 0.01 秒，1 passed，20 filtered out。stdout 没有打印密钥或口令。该测试的 `call()` 在两个本地 `PeerConnection` 之间协商并双向发送媒体；配置从 `RtcConfiguration::webrtc()` 覆盖 `connectivity` / `keying` / `webrtc_extensions` / `bind_ips` 等，两端都是 `IceLite` × `Sdes`，绑定在回环地址。这不是从 `sip()` 起步，不是 Linphone 或真实话机，也不是公网。`check_description` 会检查协议 RTP/SAVP、`a=crypto`、`a=ice-lite` 与 `a=ice-ufrag`。

这些测试全部通过，只证明协商字段、Controlled 角色，以及（仅限可选测试）两个本地连接在回环上能互发媒体，不能证明已经从话机收到 SRTP 音频。

## 诊断程序（不是官方测试，不要求学生运行）

为观察官方测试通过时并不打印的 SDP 形状，另写了一个不发表的诊断程序：对 `RtcConfiguration::sip()` 设置 `connectivity = Connectivity::IceLite`、`keying = Keying::Sdes`，调用 `create_offer` / `create_answer`。远程 offer 使用运行时生成的密钥和 ICE 凭证，不使用上游测试夹具。2026-11-27 19:46:21–19:46:55 JST，墙钟约 34 秒，退出码 0。HEAD 仍是固定提交。

脱敏后的要点：

- 库生成的配方3 offer：会话级 `a=ice-lite`；`m=` 协议为 `RTP/SAVP`；媒体级 `a=ice-ufrag`、`a=ice-pwd`、两条 `typ host` 候选（组件 1 与 2，传输写作 `udp`）、`a=end-of-candidates`；`a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>|2^31`；有 `a=rtcp-mux` 与 `a=rtcp:`；无指纹、无 `a=setup`。列出的格式是默认 Opus PT 111。
- 对「RTP/SAVP、PCMU PT 0、有 crypto 与 ICE 凭证/候选、无 `a=ice-lite`、无 `a=rtcp-mux`」的诊断 offer，answer 同样是会话级 `a=ice-lite`、协议 `RTP/SAVP`、媒体级 ICE 凭证与两条 `typ host` 候选、`a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>`（因诊断 offer 未写生存期，答案也没有 `|2^31`）、有 `a=rtcp:`、无 `a=rtcp-mux`、无指纹。诊断答案列出的仍是默认 Opus 111，不是 offer 里的 PT 0。官方测试未断言编解码交叉。
- 对照：`sip()` 只设 `IceLite`、保持 `Keying::None` 的 offer，协议为 `RTP/AVP`，有同样的 ICE 属性，没有 `a=crypto`。

地址、端口、会话标识、ufrag、ice-pwd 和密钥已删除。完整未脱敏 SDP 只留在非公开验证目录，不进入公开材料。这不是官方测试的 stdout，也不能证明已经收到媒体。

## 未测范围

Windows、真实话机、Linphone、公网，以及 Connectivity × Keying 的其余格子，均未在本轮验收。没有跑 `ice_lite_rtcp_component_nomination_keeps_rtp_pair`。不要把覆盖写成掌握。

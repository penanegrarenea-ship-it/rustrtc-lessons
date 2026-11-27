# 0022 sip()+Sdes 与 SDES-SRTP 协商：脱敏验证摘要

验证日期 2026-11-27，所有时刻为 Asia/Tokyo（JST）。上游固定 `f1b59bf6e85fa529dc0c8ed94a91e17a00cd8afa`。本轮未改库、依赖或官方示例/测试，也没有给上游开 PR。此文件是实际验证材料的字段摘录，不是用户本机结果，也不是真实 SRTP 收包或 Windows 成功记录。`a=crypto` 的 inline 密钥已删除，不在本文件中出现。

## 环境和命令

- 通过运行发生在 Linux 教学电脑：Debian GNU/Linux 13（trixie），kernel 6.12.113+。不是用户的 Windows。
- rustc 1.100.0 (0ef1bc386 2026-11-09)，cargo 1.100.0 (3acc79c0c 2026-11-05)，显式使用 `+1.100.0`。此提交 `edition = "2024"`。
- 在固定提交的仓库根目录分三组执行：
  - `cargo +1.100.0 test --lib -- --nocapture --test-threads=1 create_offer_srtp_mode`
  - `cargo +1.100.0 test --lib -- --nocapture --test-threads=1 create_answer_srtp_mode`
  - `cargo +1.100.0 test --lib -- --nocapture --test-threads=1 srtp_mode_reinvite`
- rustc 1.100.0 的测试过滤器按子串匹配。不要把 `|` 写成“或”，否则会匹配到 0 个测试。本轮因此分成上面三组。运行后 HEAD 仍是上述固定提交。工作树保持干净，未改 `/workspace/rustrtc`（共享克隆仍在 e13b5f2）。
- 编译保留原库三条 `fetch_update` 弃用警告，不是本课改了依赖。

## 官方库测试本轮结果（2026-11-27）

命令于 18:28:22 JST 开始，18:28:23 JST 结束，三组退出码均为 0。测试二进制此前已经编过，三次 `Finished test profile` 分别约为 0.25、0.21、0.18 秒；测试本身分别 0.02、0.01、0.02 秒。在全新克隆上第一次编译会更久。stdout 没有打印 ICE 密码或 `a=crypto` 密钥。

通过的 7 个测试：

- `create_offer_srtp_mode`：`sip()` + `Keying::Sdes` 的 offer 为 RTP/SAVP，有 `a=crypto`，无 `ice-ufrag` / `candidate` / `fingerprint` / `setup`。
- `create_offer_srtp_mode_includes_crypto`：协议为 RTP/SAVP，存在 `a=crypto`，值以 `1 AES_CM_128_HMAC_SHA1_80 inline:` 开头。
- `create_offer_srtp_mode_has_no_mki`：同样的前缀，并以生存期 `2^31` 结尾，不含 MKI 记号 `1:1`。
- `create_answer_srtp_mode_uses_savp_profile`：对 RTP/SAVP + `a=crypto` 的远程 offer，answer 也是 RTP/SAVP，且有 `a=crypto`。该测试未断言载荷类型。
- `create_answer_srtp_mode_echoes_offer_mki_and_tag`：名称容易误读。实际断言是回显 tag `2`、套件 `AES_CM_128_HMAC_SHA1_32` 和生存期 `|2^31`，答案不得以 `1:1` 结尾。本课不转载测试夹具里的密钥。
- `srtp_mode_reinvite_keeps_our_key_and_takes_a_new_remote_key`：同一套件的后一次 answer 保持我方发送密钥，并在交换完成后采用对端新密钥。
- `srtp_mode_reinvite_suite_change_generates_a_new_key`：套件从 `AES_CM_128_HMAC_SHA1_80` 改为 `AES_CM_128_HMAC_SHA1_32` 时，生成新的本端密钥；同一套件则复用。

本轮没有跑 `srtp_mode_ice_lite_answer_has_ice_attributes`（配方3，不是本课主路径），也没有跑 `tests/connectivity_keying.rs` 里两端互发媒体的测试，没有跑真实话机或公网。这些测试全部通过，只证明协商字段和 re-INVITE 密钥策略，不能证明已经收到 SRTP 音频。

## 诊断程序（不是官方测试，不要求学生运行）

为观察官方测试通过时并不打印的 SDP 形状，另写了一个不发表的诊断程序：对 `RtcConfiguration::sip()` 设置 `keying = Keying::Sdes`，调用 `create_offer` / `create_answer`。远程 offer 使用运行时生成的密钥，不使用上游测试夹具密钥。2026-11-27 18:29:03–18:29:38 JST，编译约 34.33 秒，退出码 0。HEAD 仍是固定提交。

脱敏后的要点：

- 库生成的 offer：`m=` 协议为 `RTP/SAVP`，`a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<redacted>|2^31`，有 `a=rtcp-mux` 与 `a=rtcp:`，无 ICE / 指纹 / `a=setup`。列出的格式是默认 Opus PT 111。
- 对「无生存期、tag 1、SHA1_80」的诊断 offer，answer 回显 tag 1 与同一套件，但没有 `|2^31`（与实现里只在解析到生存期时才重建 tail 一致）。
- 对 tag 2、`AES_CM_128_HMAC_SHA1_32`、生存期 `2^31`、MKI `1:1` 的诊断 offer，answer 为 `a=crypto:2 AES_CM_128_HMAC_SHA1_32 inline:<redacted>|2^31`，没有 MKI。

地址、端口、会话标识和密钥已删除。完整未脱敏 SDP 只留在非公开验证目录，不进入公开材料。这不是官方测试的 stdout，也不能证明已经收到媒体。

## 未测范围

Windows、真实话机、实际 SRTP 包交换、公网、IceLite 配方3，以及 Connectivity × Keying 的其余格子，均未在本轮验收。不要把覆盖写成掌握。

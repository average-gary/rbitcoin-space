//! The coinbase tag of the Stratum V2 reference implementation (SRI), read strictly.
//!
//! No specification lays this tag out: sv2-spec does not mention it. It is the convention of
//! SRI's job factory (stratum-mining/stratum, `channels_sv2`), described in
//! <https://github.com/stratum-mining/stratum/discussions/2141> and written with the `Sv2/`
//! prefix since stratum v1.12.0. The coinbase input script is
//!
//! ```text
//! coinbase_prefix || push("Sv2/<pool_tag>/<miner_tag>/") || push(extranonce)
//! ```
//!
//! - `coinbase_prefix` is the template's: the BIP34 height, then at most a few more bytes (older
//!   Bitcoin Core templates add an `OP_0`). sv2-spec's Template Distribution Protocol allows it
//!   8 bytes (`NewTemplate.coinbase_prefix`).
//! - The tag is one direct push of UTF-8 text. Either field may be empty, and both delimiters are
//!   always written: `Sv2///` names nobody. Nothing is escaped, so the miner's field may hold `/`.
//! - The extranonce is one direct push of at most 32 bytes, and ends the script.
//!
//! [`tag`] accepts exactly that:
//!
//! 1. The script is walked from its start, one operation at a time: a direct push (opcodes
//!    `0x01` to `0x4b`, with all its bytes present) or a one-byte opcode that carries no data
//!    (`OP_0`, and `OP_1NEGATE` to `OP_16`, which is how BIP34 writes heights 1 to 16). Anything
//!    else ends the walk with no tag.
//! 2. The tag is the first direct push that starts after the script's first byte and no later
//!    than byte 8, and whose data starts with `Sv2/`, ends with `/`, is UTF-8 and holds another
//!    `/` between the two. The pool's field runs to that first `/`; the miner's is the rest.
//! 3. One direct push of 1 to 32 bytes follows the tag and ends the script.
//!
//! The script is written by whoever mined the block: reading it allocates nothing, visits at most
//! nine operations and the tag's bytes, and cannot panic.

/// The longest `coinbase_prefix` a template may carry, so the last byte a tag push may start at.
const MAX_PREFIX: usize = 8;
/// The longest full extranonce (SRI itself uses 20 bytes).
const MAX_EXTRANONCE: usize = 32;
const MARK: &[u8] = b"Sv2/";
/// The last opcode that pushes as many bytes as its own value.
const MAX_DIRECT_PUSH: u8 = 0x4b;

/// The two fields of a coinbase tag in the Stratum V2 reference implementation's layout. Both are
/// UTF-8, and either may be empty.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tag<'a> {
    /// Written by the pool. Empty when the miner built the job (Job Declaration).
    pub pool: &'a [u8],
    /// The pool's field between its two delimiters, as the script holds it: `/<pool>/`. A tag a
    /// pool list writes with slashes, like `/ViaBTC/`, is found here and not in `pool`.
    pub delimited: &'a [u8],
    /// The miner's own words; may hold `/`.
    pub miner: &'a [u8],
}

/// Reads `script` (a coinbase input script) as
/// `prefix || push("Sv2/<pool>/<miner>/") || push(extranonce)`: the module's rules 1 to 3.
/// `None` for any script not laid out exactly so.
pub fn tag(script: &[u8]) -> Option<Tag<'_>> {
    let mut rest = script;
    let mut offset = 0usize;
    while offset <= MAX_PREFIX {
        let (&op, after) = rest.split_first()?;
        match op {
            1..=MAX_DIRECT_PUSH => {
                let (data, after) = after.split_at_checked(usize::from(op))?;
                // At offset 0 sits the height, whatever it reads as.
                if offset > 0
                    && let Some(tag) = fields(data)
                {
                    return ends_with_extranonce(after).then_some(tag);
                }
                offset = offset.saturating_add(1).saturating_add(data.len());
                rest = after;
            }
            // OP_0, OP_1NEGATE, OP_RESERVED and OP_1 to OP_16: one byte, no data.
            0x00 | 0x4f..=0x60 => {
                offset = offset.saturating_add(1);
                rest = after;
            }
            _ => return None,
        }
    }
    None
}

/// The fields of a push that reads `Sv2/<pool>/<miner>/`.
fn fields(push: &[u8]) -> Option<Tag<'_>> {
    let inside = push.strip_prefix(MARK)?.strip_suffix(b"/")?;
    std::str::from_utf8(inside).ok()?;
    // A `/` byte is never part of a longer UTF-8 character, so both halves stay UTF-8.
    let mut halves = inside.splitn(2, |&b| b == b'/');
    let pool = halves.next()?;
    let miner = halves.next()?;
    // From the `/` that ends the mark to the one that ends the pool's field.
    let delimited = push
        .get(MARK.len().saturating_sub(1)..)?
        .get(..pool.len().saturating_add(2))?;
    Some(Tag {
        pool,
        delimited,
        miner,
    })
}

/// Whether `rest` is exactly one direct push of 1 to [`MAX_EXTRANONCE`] bytes.
fn ends_with_extranonce(rest: &[u8]) -> bool {
    rest.split_first().is_some_and(|(&n, data)| {
        let n = usize::from(n);
        (1..=MAX_EXTRANONCE).contains(&n) && data.len() == n
    })
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::indexing_slicing)]

    use super::*;

    fn hex(h: &str) -> Vec<u8> {
        (0..h.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&h[i..i + 2], 16).unwrap())
            .collect()
    }

    /// The script `prefix || push(text) || push(20 zero bytes)`.
    fn script(prefix: &[u8], text: &[u8]) -> Vec<u8> {
        let mut s = prefix.to_vec();
        s.push(text.len() as u8);
        s.extend_from_slice(text);
        s.push(20);
        s.extend_from_slice(&[0; 20]);
        s
    }

    fn read(script: &[u8]) -> Option<(&str, &str)> {
        tag(script).map(|t| {
            (
                std::str::from_utf8(t.pool).unwrap(),
                std::str::from_utf8(t.miner).unwrap(),
            )
        })
    }

    const HEIGHT: &[u8] = &[0x03, 0x98, 0xe5, 0x0e];

    /// Coinbase scripts of real blocks: mainnet 976,280 and 975,369 (MARA Pool), Testnet 5 129
    /// and 4363 (plebhash) and Testnet 5 2408 (jaonoctus, whose miner field holds a `/`).
    #[test]
    fn real_blocks() {
        for (script, pool, miner) in [
            (
                "0398e50e1a5376322f4d415241f09f87baf09f87b8f09f87baf09f87b82f2f14020000140000000000000000000005cf0007c4fa",
                "MARA🇺🇸🇺🇸",
                "",
            ),
            (
                "0309e20e1a5376322f4d415241f09f87baf09f87b8f09f87baf09f87b82f2f1401000000000000000000000000001014b8050000",
                "MARA🇺🇸🇺🇸",
                "",
            ),
            (
                "028100195376322fe29b8fefb88f20706c65626861736820e29aa12f2f140100000000000000000000000000000000000000",
                "⛏️ plebhash ⚡",
                "",
            ),
            (
                "020b11195376322fe29b8fefb88f20706c65626861736820e29aa12f2f140100000f00000000000000000000000000000000",
                "⛏️ plebhash ⚡",
                "",
            ),
            (
                "026809285376322f406a616f6e6f637475732f6361736132312e76696e7465756d2e6f72672f30783533392f140100000000000000d4d7f86a000000000000d898",
                "@jaonoctus",
                "casa21.vinteum.org/0x539",
            ),
        ] {
            assert_eq!(read(&hex(script)), Some((pool, miner)), "{script}");
        }
    }

    #[test]
    fn either_field_may_be_empty() {
        assert_eq!(read(&script(HEIGHT, b"Sv2///")), Some(("", "")));
        assert_eq!(read(&script(HEIGHT, b"Sv2/pool//")), Some(("pool", "")));
        assert_eq!(read(&script(HEIGHT, b"Sv2//miner/")), Some(("", "miner")));
        assert_eq!(read(&script(HEIGHT, b"Sv2/p/m/")), Some(("p", "m")));
        // Only the first delimiter divides: the rest is the miner's.
        assert_eq!(read(&script(HEIGHT, b"Sv2//a/b//")), Some(("", "a/b/")));
        // The pool's field with its delimiters, whatever the miner's holds.
        for (text, delimited) in [
            (&b"Sv2///"[..], &b"//"[..]),
            (b"Sv2/pool//", b"/pool/"),
            (b"Sv2//miner/", b"//"),
            (b"Sv2/p/m/", b"/p/"),
            (b"Sv2//a/b//", b"//"),
            ("Sv2/MARA🇺🇸🇺🇸//".as_bytes(), "/MARA🇺🇸🇺🇸/".as_bytes()),
        ] {
            let script = script(HEIGHT, text);
            assert_eq!(tag(&script).unwrap().delimited, delimited, "{text:?}");
        }
        // The longest direct push.
        let mut long = b"Sv2/".to_vec();
        long.extend_from_slice(&[b'p'; 69]);
        long.extend_from_slice(b"//");
        assert_eq!(long.len(), 75);
        assert_eq!(tag(&script(HEIGHT, &long)).unwrap().pool, [b'p'; 69]);
    }

    #[test]
    fn the_prefix_may_hold_more_than_the_height() {
        // Height 2 (`OP_2`), then the `OP_0` older templates add.
        assert_eq!(
            read(&script(&[0x52, 0x00], b"Sv2/pool/miner/")),
            Some(("pool", "miner"))
        );
        // A mainnet height, then `OP_0`.
        assert_eq!(
            read(&script(&[0x03, 0x98, 0xe5, 0x0e, 0x00], b"Sv2/pool//")),
            Some(("pool", ""))
        );
        // Heights 1 to 16 are `OP_1` to `OP_16`, alone.
        assert_eq!(read(&script(&[0x51], b"Sv2/a/b/")), Some(("a", "b")));
        assert_eq!(read(&script(&[0x60], b"Sv2/a/b/")), Some(("a", "b")));
        // A prefix of the full 8 bytes: the tag push starts at byte 8.
        let eight = [0x03, 0x98, 0xe5, 0x0e, 0x03, 1, 2, 3];
        assert_eq!(read(&script(&eight, b"Sv2/a/b/")), Some(("a", "b")));
        // The first push that reads as a tag is the tag; a second such push is its extranonce.
        let mut twice = vec![0x51, 6];
        twice.extend_from_slice(b"Sv2///");
        twice.push(7);
        twice.extend_from_slice(b"Sv2/x//");
        assert_eq!(read(&twice), Some(("", "")));
    }

    #[test]
    fn text_that_is_not_the_tag() {
        for text in [
            // SRI before the `Sv2/` prefix.
            &b"/pool/miner/"[..],
            b"Sv2/pool/miner",
            b"Sv2/x/",
            b"Sv2/",
            b"Sv2",
            b"sv2/pool//",
            b"SV2/pool//",
            b" Sv2/pool//",
            b"/Sv2/pool//",
            // Not UTF-8: a lone continuation byte, a cut character, and Latin-1.
            b"Sv2/po\x80ol//",
            b"Sv2/pool/\xf0\x9f\x87/",
            b"Sv2/caf\xe9//",
            // The tag inside a longer push of other text.
            b"Mined by Sv2/pool// for you",
            b"Sv2/pool// and more",
        ] {
            assert_eq!(read(&script(HEIGHT, text)), None, "{text:?}");
        }
    }

    #[test]
    fn layouts_that_are_not_the_convention() {
        let text = b"Sv2/pool/miner/";
        let good = script(HEIGHT, text);
        assert!(tag(&good).is_some());
        // The tag as the script's first push: nothing stands where the height does.
        assert_eq!(tag(&script(&[], text)), None);
        // The tag push starting at byte 9.
        let nine = [0x03, 0x98, 0xe5, 0x0e, 0x04, 1, 2, 3, 4];
        assert_eq!(tag(&script(&nine, text)), None);
        assert_eq!(tag(&script(&[0x51; 9], text)), None);
        // No extranonce, an empty one, one of 33 bytes, and one of 32.
        let tagged = &good[..good.len() - 21];
        assert_eq!(tag(tagged), None);
        let with = |extra: &[u8]| [tagged, extra].concat();
        assert_eq!(tag(&with(&[0x00])), None);
        assert_eq!(tag(&with(&[&[33u8][..], &[0; 33]].concat())), None);
        assert!(tag(&with(&[&[32u8][..], &[0; 32]].concat())).is_some());
        assert!(tag(&with(&[1, 0])).is_some());
        // Bytes after the extranonce, and an extranonce cut short.
        assert_eq!(tag(&with(&[&[20u8][..], &[0; 21]].concat())), None);
        assert_eq!(tag(&with(&[&[20u8][..], &[0; 19]].concat())), None);
        // The extranonce pushed any other way.
        assert_eq!(tag(&with(&[&[0x4c, 20][..], &[0; 20]].concat())), None);
        // A tag push cut short, at every length.
        for cut in 0..good.len() {
            assert_eq!(tag(&good[..cut]), None, "{cut}");
        }
        // The tag pushed with OP_PUSHDATA1, and other opcodes before it.
        let mut pushdata = HEIGHT.to_vec();
        pushdata.extend_from_slice(&[0x4c, text.len() as u8]);
        pushdata.extend_from_slice(text);
        pushdata.extend_from_slice(&[&[20u8][..], &[0; 20]].concat());
        assert_eq!(tag(&pushdata), None);
        for op in [0x4c, 0x4d, 0x4e, 0x61, 0x6a, 0x75, 0xac, 0xff] {
            let prefix = [0x03, 0x98, 0xe5, 0x0e, op];
            assert_eq!(tag(&script(&prefix, text)), None, "{op:#x}");
        }
    }

    /// Coinbase scripts that are not Stratum V2's: Testnet 5 block 2540 (`ckpool%/@jaonoctus/…`)
    /// and mainnet blocks of Foundry USA (976,277), ViaBTC (976,293), F2Pool (976,276), AntPool
    /// (976,281), MARA Pool's older tag (976,273) and the genesis block.
    #[test]
    fn other_real_blocks_have_no_tag() {
        for script in [
            "02ec090004def3f86a04bb0d2f060c20ecf86a03004300000000000a636b706f6f6c252f406a616f6e6f637475732f6361736132312e76696e7465756d2e6f72672f30783533392f",
            "0395e50e0494a417532f466f756e6472792055534120506f6f6c202364726f70676f6c642f55b585708c7e060000000000",
            "03a5e50e162f5669614254432f4d696e6564206279206a6161672f2cfabe6d6dc1ca35e8633ba92153a43a02f48f06ebee4ff6ef7d8f5d03cdb197264ec2062b100000000000000010a8abe80371ded038272108c1a104000000000000",
            "0394e50e2cfabe6d6d7521bafbba66909f7261162406cb6ace63d862a1462ce5036222f0736bbe51b410000000f09f909f092f4632506f6f6c2f6b00000000000000000000000000000000000000000000000000000000000000000000000500e73b0200",
            "0399e50e1b4d696e656420627920416e74506f6f6c3936302001b50657f5e1aefabe6d6d88e6c8ebd878ffd41799ec871bac78563446fa122e3aa69ad17293a7495f9f01100000000000000000005e54c400000000000000",
            "0391e50e048446fc6a7c204d415241204d61646520696e2055534120f09f87baf09f87b8207c763035137d71b65e0000000000ffffffff",
            "04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73",
        ] {
            assert_eq!(tag(&hex(script)), None, "{script}");
        }
    }

    #[test]
    fn hostile_input_is_harmless() {
        assert_eq!(tag(b""), None);
        for len in [1, 2, 9, 100, 10_000usize] {
            for byte in 0..=255u8 {
                assert_eq!(tag(&vec![byte; len]), None, "{len} of {byte:#x}");
            }
        }
        let junk: Vec<u8> = (0..10_000u32).map(|i| (i * 7919 % 251) as u8).collect();
        for start in 0..junk.len() {
            assert_eq!(tag(&junk[start..]), None, "{start}");
        }
        // A real script with any one byte changed or dropped never panics, whatever it reads as.
        let real = hex(
            "0398e50e1a5376322f4d415241f09f87baf09f87b8f09f87baf09f87b82f2f14020000140000000000000000000005cf0007c4fa",
        );
        for i in 0..real.len() {
            for byte in 0..=255u8 {
                let mut changed = real.clone();
                changed[i] = byte;
                let _ = tag(&changed);
            }
            let mut dropped = real.clone();
            dropped.remove(i);
            let _ = tag(&dropped);
        }
    }
}

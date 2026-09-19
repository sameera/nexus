/**
 * Where a workbook lives, stated by the library that owns workbooks.
 *
 * The path was previously read from the pipeline's store register, which is the list of directories
 * a Nexus stage withholds from every diff it derives (decision record #450). That register still
 * names the workbook store and still must, because a workbook is generated surface a stage must
 * never read back as behaviour. But the two facts are different facts, and epic #677 separates the
 * packages that hold them: the register says what Nexus withholds, and this module says where the
 * teaching stage writes. While both live in one workspace a spec beside the register pins that they
 * agree, so the separation is provably behaviour-preserving rather than merely plausible.
 */

/** The hidden root Nexus-managed stores sit under. */
export const NEXUS_ROOT_DIRNAME: string = ".nexus";

/** The workbook store's directory name beneath that root. */
export const WORKBOOK_STORE_DIRNAME: string = "workbook";

/** The repo-relative path of the workbook store. */
export const WORKBOOK_STORE_PATH: string = `${NEXUS_ROOT_DIRNAME}/${WORKBOOK_STORE_DIRNAME}`;

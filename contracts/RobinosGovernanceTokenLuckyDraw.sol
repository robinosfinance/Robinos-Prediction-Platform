// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.3.2 (token/ERC721/ERC721.sol)

pragma solidity ^0.8.10;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 *
 * Alternatively, {ERC165Storage} provides an easier to use but more expensive implementation.
 */
abstract contract ERC165 is IERC165 {
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

interface StandardToken {
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external;

    function transfer(address _to, uint256 _value) external;

    function approve(address _spender, uint256 _value) external;

    function allowance(address _owner, address _spender) external view returns (uint256);

    function balanceOf(address _owner) external returns (uint256);
}

/**
 * @dev Required interface of an ERC721 compliant contract.
 */
interface IERC721 is IERC165 {
    /**
     * @dev Emitted when `tokenId` token is transferred from `from` to `to`.
     */
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables `approved` to manage the `tokenId` token.
     */
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    /**
     * @dev Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.
     */
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    /**
     * @dev Returns the number of tokens in ``owner``'s account.
     */
    function balanceOf(address owner) external view returns (uint256 balance);

    /**
     * @dev Returns the owner of the `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must be have been allowed to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    /**
     * @dev Transfers `tokenId` token from `from` to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {safeTransferFrom} whenever possible.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    /**
     * @dev Gives permission to `to` to transfer `tokenId` token to another account.
     * The approval is cleared when the token is transferred.
     *
     * Only a single account can be approved at a time, so approving the zero address clears previous approvals.
     *
     * Requirements:
     *
     * - The caller must own the token or be an approved operator.
     * - `tokenId` must exist.
     *
     * Emits an {Approval} event.
     */
    function approve(address to, uint256 tokenId) external;

    /**
     * @dev Returns the account approved for `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function getApproved(uint256 tokenId) external view returns (address operator);

    /**
     * @dev Approve or remove `operator` as an operator for the caller.
     * Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.
     *
     * Requirements:
     *
     * - The `operator` cannot be the caller.
     *
     * Emits an {ApprovalForAll} event.
     */
    function setApprovalForAll(address operator, bool _approved) external;

    /**
     * @dev Returns if the `operator` is allowed to manage all of the assets of `owner`.
     *
     * See {setApprovalForAll}
     */
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;
}

/**
 * @title ERC721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC721 asset contracts.
 */
interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

abstract contract ERC721Receiver {
    bytes4 constant receiverSignature = bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external virtual returns (bytes4) {
        return receiverSignature;
    }
}

/**
 * @title ERC-721 Non-Fungible Token Standard, optional metadata extension
 * @dev See https://eips.ethereum.org/EIPS/eip-721
 */
interface IERC721Metadata is IERC721 {
    /**
     * @dev Returns the token collection name.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the token collection symbol.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCall(target, data, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");

        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        require(isContract(target), "Address: static call to non-contract");

        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(isContract(target), "Address: delegate call to non-contract");

        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verifies that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

/**
 * @dev String operations.
 */
library Strings {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
}

/**
 * @dev Implementation of https://eips.ethereum.org/EIPS/eip-721[ERC721] Non-Fungible Token Standard, including
 * the Metadata extension, but not including the Enumerable extension, which is available separately as
 * {ERC721Enumerable}.
 */
contract ERC721 is Context, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Mapping from token ID to owner address
    mapping(uint256 => address) private _owners;

    // Mapping owner address to token count
    mapping(address => uint256) private _balances;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _balances[owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overriden in child contracts.
     */
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public virtual override {
        address owner = ERC721.ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");

        return _tokenApprovals[tokenId];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");

        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * `_data` is additional data, it has no specified format and it is sent in call to `to`.
     *
     * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
     * implement alternative mechanisms to perform token transfer, such as signature-based.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = ERC721.ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    /**
     * @dev Safely mints `tokenId` and transfers it to `to`.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    /**
     * @dev Same as {xref-ERC721-_safeMint-address-uint256-}[`_safeMint`], with an additional `data` parameter which is
     * forwarded in {IERC721Receiver-onERC721Received} to contract recipients.
     */
    function _safeMint(
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, _data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId);

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal virtual {
        address owner = ERC721.ownerOf(tokenId);

        _beforeTokenTransfer(owner, address(0), tokenId);

        // Clear approvals
        _approve(address(0), tokenId);

        _balances[owner] -= 1;
        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer of token that is not own");
        require(to != address(0), "ERC721: transfer to the zero address");

        _beforeTokenTransfer(from, to, tokenId);

        // Clear approvals from the previous owner
        _approve(address(0), tokenId);

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    /**
     * @dev Approve `to` to operate on `tokenId`
     *
     * Emits a {Approval} event.
     */
    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(ERC721.ownerOf(tokenId), to, tokenId);
    }

    /**
     * @dev Approve `operator` to operate on all of `owner` tokens
     *
     * Emits a {ApprovalForAll} event.
     */
    function _setApprovalForAll(
        address owner,
        address operator,
        bool approved
    ) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param _data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning.
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s `tokenId` will be
     * transferred to `to`.
     * - When `from` is zero, `tokenId` will be minted for `to`.
     * - When `to` is zero, ``from``'s `tokenId` will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}
}

abstract contract MatchingStrings {
    function matchStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

abstract contract DeployingInBatches is ERC721, Ownable, MatchingStrings {
    struct BatchData {
        string name;
        uint256 numOfTokens;
        bool initialized;
    }

    BatchData[] batchDataArray;
    mapping(string => uint256) private _batchNameToBatchIndexMapping;
    mapping(uint256 => uint256) private _tokenIndexToBatchIndexMapping;

    function batchExists(string memory batchName) private view returns (bool) {
        if (batchDataArray.length == 0) return false;
        BatchData storage batchData = batchDataArray[_batchNameToBatchIndexMapping[batchName]];
        string memory batchDataName = batchData.name;
        return matchStrings(batchDataName, batchName) && batchData.initialized;
    }

    function getBatchIndex(string memory batchName) private view returns (uint256) {
        require(batchExists(batchName), "DeployingInBatches: Batch not initialized");
        return _batchNameToBatchIndexMapping[batchName];
    }

    function getBatch(string memory batchName) private view returns (BatchData storage) {
        uint256 batchIndex = getBatchIndex(batchName);
        return batchDataArray[batchIndex];
    }

    function numOfBatches() public view returns (uint256) {
        return batchDataArray.length;
    }

    function getBatchData(string memory batchName) public view returns (string memory, uint256) {
        BatchData storage batchData = getBatch(batchName);
        return (batchData.name, batchData.numOfTokens);
    }

    function createBatch(string memory batchName) private returns (BatchData storage) {
        require(!batchExists(batchName), "DeployingInBatches: Batch is already initialized");
        uint256 batchIndex = batchDataArray.length;
        _batchNameToBatchIndexMapping[batchName] = batchIndex;
        batchDataArray.push(BatchData(batchName, 0, true));
        return batchDataArray[batchIndex];
    }

    function allTokensInitialized(uint256[] memory tokenIds) private view returns (bool) {
        return allTokensInitialized(tokenIds, true);
    }

    function allTokensInitialized(uint256[] memory tokenIds, bool expectedToBeInitialized)
        internal
        view
        returns (bool)
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (
                (expectedToBeInitialized && !_exists(tokenIds[i])) || (!expectedToBeInitialized && _exists(tokenIds[i]))
            ) return false;
        }
        return true;
    }

    function linkTokensToBatch(uint256[] memory tokenIds, string memory batchName) internal {
        require(allTokensInitialized(tokenIds), "DeployingInBatches: some of the tokens are not minted");

        BatchData storage batchData;
        batchData = batchExists(batchName) ? getBatch(batchName) : createBatch(batchName);
        uint256 batchIndex = getBatchIndex(batchName);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _tokenIndexToBatchIndexMapping[tokenIds[i]] = batchIndex;
            batchData.numOfTokens++;
        }
    }
}

abstract contract PollFactory is Ownable {
    struct PollData {
        string question;
        string[] answers;
        uint256[] answerVotes;
        uint256 totalVotes;
        bool initialized;
    }

    mapping(bytes32 => PollData) private pollDataHashTable;
    bytes32[] private pollDataHashArray;
    mapping(address => bool) private whiteListedAddresses;
    mapping(address => mapping(bytes32 => bool)) private userAlreadyVotedHashTable;

    function whitelistAddress(address toWhitelist) public onlyOwner {
        require(toWhitelist != address(0), "PollFactory: zero address");
        require(!whiteListedAddresses[toWhitelist], "PollFactory: address already whitelisted");
        whiteListedAddresses[toWhitelist] = true;
    }

    function removeAddressFromWhitelist(address toRemove) public onlyOwner {
        require(toRemove != address(0), "PollFactory: zero address");
        require(whiteListedAddresses[toRemove], "PollFactory: address already whitelisted");
        whiteListedAddresses[toRemove] = false;
    }

    modifier whitelistedSender() {
        require(whiteListedAddresses[_msgSender()], "PollFactory: sender is not whitelisted");
        _;
    }

    /**
     * Function allows owner to create a new poll. The combination of question and answers must be unique
     * @param question of the poll
     * @param answers of the poll. ORDER MATTERS!
     */
    function createNewPoll(string memory question, string[] memory answers) public onlyOwner returns (bytes32) {
        bytes32 pollHash = getPollHash(question, answers);
        require(!pollExists(pollHash), "PollFactory: Poll already initialized");

        uint256[] memory answerVotes = new uint256[](answers.length);
        pollDataHashTable[pollHash] = PollData(question, answers, answerVotes, 0, true);
        pollDataHashArray.push(pollHash);
        return pollHash;
    }

    /**
     * Poll signature is created from question and array of answers. This means the same question with different answers can be deployed
     * @param question of the poll
     * @param answers of the poll. ORDER MATTERS!
     */
    function getPollHash(string memory question, string[] memory answers) private pure returns (bytes32) {
        require(bytes(question).length > 0, "PollFactory: empty question given");
        for (uint256 i = 0; i < answers.length; i++) {
            require(bytes(answers[i]).length > 0, "PollFactory: empty answer given");
        }

        return keccak256(bytes(concatArrayOfStrings(packPollParams(question, answers))));
    }

    function packPollParams(string memory question, string[] memory answers) private pure returns (string[] memory) {
        string[] memory pollPacked = new string[](1);
        pollPacked[0] = concatStrings(question, "|");
        string[] memory answersPacked = packAnswers(answers);
        return concatArrays(pollPacked, answersPacked);
    }

    function packAnswers(string[] memory answers) private pure returns (string[] memory) {
        string[] memory answersPacked = new string[](answers.length);
        for (uint256 i = 0; i < answers.length; i++) {
            answersPacked[i] = i < answers.length - 1 ? concatStrings(answers[i], ",") : answers[i];
        }
        return answersPacked;
    }

    function concatArrays(string[] memory a, string[] memory b) public pure returns (string[] memory) {
        uint256 finalLength = a.length + b.length;
        string[] memory finalArray = new string[](finalLength);
        string memory tempString;
        for (uint256 i = 0; i < finalLength; i++) {
            tempString = i < a.length ? a[i] : b[i - a.length];
            finalArray[i] = tempString;
        }
        return finalArray;
    }

    function getPollData(bytes32 pollHash) private view returns (PollData storage) {
        require(pollExists(pollHash), "PollFactory: Poll not initialized");
        return pollDataHashTable[pollHash];
    }

    function getPoll(string memory question, string[] memory answers)
        public
        view
        returns (
            string memory,
            string memory,
            uint256[] memory,
            uint256
        )
    {
        return getPoll(getPollHash(question, answers));
    }

    function getPoll(uint256 index)
        public
        view
        returns (
            string memory,
            string memory,
            uint256[] memory,
            uint256
        )
    {
        require(index < totalPolls(), "PollFactory: poll index out of bounds");
        return getPoll(pollDataHashArray[index]);
    }

    function getPoll(bytes32 pollHash)
        private
        view
        returns (
            string memory,
            string memory,
            uint256[] memory,
            uint256
        )
    {
        PollData storage pollData = getPollData(pollHash);
        return (
            pollData.question,
            concatArrayOfStrings(packAnswers(pollData.answers)),
            pollData.answerVotes,
            pollData.totalVotes
        );
    }

    function pollExists(bytes32 pollHash) private view returns (bool) {
        return pollDataHashTable[pollHash].initialized;
    }

    function totalPolls() public view returns (uint256) {
        return pollDataHashArray.length;
    }

    function concatArrayOfStrings(string[] memory strings) private pure returns (string memory) {
        string memory finalString = "";
        for (uint256 i = 0; i < strings.length; i++) {
            finalString = concatStrings(finalString, strings[i]);
        }
        return finalString;
    }

    function concatStrings(string memory a, string memory b) private pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    /**
     * Function allows any whitelisted user to cast a vote. They need to provide the exact question and answers in the poll to match the poll signature
     * @param question of the poll
     * @param answers of the poll. Must be in the same order
     * @param answerIndex of the chosen answer. Reverts if index out of bounds
     */
    function vote(
        string memory question,
        string[] memory answers,
        uint256 answerIndex
    ) public whitelistedSender {
        bytes32 pollHash = getPollHash(question, answers);
        require(!userAlreadyVotedHashTable[_msgSender()][pollHash], "PollFactory: user already voted on poll");
        PollData storage pollData = getPollData(pollHash);
        require(answerIndex < pollData.answerVotes.length, "PollFactory: answer index out of bounds");
        pollData.answerVotes[answerIndex]++;
        pollData.totalVotes++;
        userAlreadyVotedHashTable[_msgSender()][pollHash] = true;
    }
}

abstract contract ReadingTime {
    // Return current timestamp
    function time() internal view returns (uint256) {
        return block.timestamp;
    }
}

abstract contract SaleFactory is Ownable, ReadingTime {
    // Each sale has an entry in the eventCode hash table with start and end time.
    // If both saleStart and saleEnd are 0, sale is not initialized
    struct Sale {
        uint256 saleStart;
        uint256 saleEnd;
    }
    mapping(bytes32 => Sale) private _eventSale;
    bytes32[] private _allSales;

    // Modifier allowing a call if and only if there are no active sales at the moment
    modifier noActiveSale() {
        for (uint256 i; i < _allSales.length; i++) {
            require(!saleIsActive(_eventSale[_allSales[i]]), "SaleFactory: unavailable while a sale is active");
        }
        _;
    }

    // Modifier allowing a call only if event by eventCode is currently active
    modifier duringSale(string memory eventCode) {
        Sale storage eventSale = getEventSale(eventCode);
        require(saleIsActive(eventSale), "SaleFactory: function can only be called during sale");
        _;
        clearExpiredSales();
    }

    // Modifier allowing a call only if event by eventCode is currently inactive
    modifier outsideOfSale(string memory eventCode) {
        // We are fetching the event directly through a hash, since getEventSale reverts if sale is not initialized
        Sale storage eventSale = _eventSale[hashStr(eventCode)];
        require(!saleIsActive(eventSale), "SaleFactory: function can only be called outside of sale");

        _;
    }

    function saleIsActive(Sale memory sale) private view returns (bool) {
        return (time() >= sale.saleStart) && (time() < sale.saleEnd);
    }

    // Returns all active or soon-to-be active sales in an array ordered by sale end time
    function getAllSales() public view returns (Sale[] memory) {
        uint256 length = _allSales.length;

        Sale[] memory sales = new Sale[](length);

        for (uint256 i; i < length; i++) {
            sales[i] = _eventSale[_allSales[i]];
        }
        return sales;
    }

    // Clears all sales from the _allSales array who's saleEnd time is in the past
    function clearExpiredSales() private returns (bool) {
        uint256 length = _allSales.length;
        if (length > 0 && _eventSale[_allSales[0]].saleEnd <= time()) {
            uint256 endDelete = 1;

            bytes32[] memory copyAllSales = _allSales;

            uint256 i = 1;
            while (i < length) {
                if (_eventSale[_allSales[i]].saleEnd > time()) {
                    endDelete = i;
                    break;
                }
                i++;
            }

            for (i = 0; i < length; i++) {
                if (i < length - endDelete) {
                    _allSales[i] = copyAllSales[i + endDelete];
                } else {
                    _allSales.pop();
                }
            }
        }
        return true;
    }

    function hashStr(string memory str) internal pure returns (bytes32) {
        return bytes32(keccak256(bytes(str)));
    }

    /**
     * @dev Function inserts a sale reference in the _allSales array and orders it by saleEnd time
     * in ascending order. This means the first sale in the array will expire first.
     * @param saleHash hash reference to the sale mapping structure
     */
    function insertSale(bytes32 saleHash) private returns (bool) {
        uint256 length = _allSales.length;

        bytes32 unorderedSale = saleHash;
        bytes32 tmpSale;

        for (uint256 i; i <= length; i++) {
            if (i == length) {
                _allSales.push(unorderedSale);
            } else {
                if (_eventSale[_allSales[i]].saleEnd > _eventSale[unorderedSale].saleEnd) {
                    tmpSale = _allSales[i];
                    _allSales[i] = unorderedSale;
                    unorderedSale = tmpSale;
                }
            }
        }
        return true;
    }

    /**
     * @dev Function returns Sale struct with saleEnd and saleStart. Function reverts if event is not initialized
     * @param eventCode string code of event
     */
    function getEventSale(string memory eventCode) private view returns (Sale storage) {
        Sale storage eventSale = _eventSale[hashStr(eventCode)];
        require(eventSale.saleStart > 0 || eventSale.saleEnd > 0, "SaleFactory: sale not initialized");
        return eventSale;
    }

    /**
     * @dev Function to set the start and end time of the next sale.
     * Can only be called if there is currently no active sale and needs to be called by the owner of the contract.
     * @param start Unix time stamp of the start of sale. Needs to be a timestamp in the future. If the start is 0, the sale will start immediately.
     * @param end Unix time stamp of the end of sale. Needs to be a timestamp after the start
     */
    function setSaleStartEnd(
        string memory eventCode,
        uint256 start,
        uint256 end
    ) public onlyOwner outsideOfSale(eventCode) returns (bool) {
        bool initialized;
        bytes32 saleHash = hashStr(eventCode);
        Sale storage eventSale = _eventSale[saleHash];
        if (eventSale.saleStart == 0 && eventSale.saleEnd == 0) {
            initialized = false;
        }

        if (start != 0) {
            require(start > time(), "SaleFactory: given past sale start time");
        } else {
            start = time();
        }
        require(end > start, "SaleFactory: sale end time needs to be greater than start time");

        eventSale.saleStart = start;
        eventSale.saleEnd = end;

        if (!initialized) {
            insertSale(saleHash);
        }

        return true;
    }

    // Function can be called by the owner during a sale to end it prematurely
    function endSaleNow(string memory eventCode) public onlyOwner duringSale(eventCode) returns (bool) {
        Sale storage eventSale = getEventSale(eventCode);

        eventSale.saleEnd = time();
        return true;
    }

    /**
     * @dev Public function which provides info if there is currently any active sale and when the sale status will update.
     * Value saleActive represents if sale is active at the current moment.
     * If sale has been initialized, saleStart and saleEnd will return UNIX timestampts
     * If sale has not been initialized, function will revert.
     * @param eventCode string code of event
     */
    function isSaleOn(string memory eventCode)
        public
        view
        returns (
            bool saleActive,
            uint256 saleStart,
            uint256 saleEnd
        )
    {
        Sale storage eventSale = getEventSale(eventCode);

        if (eventSale.saleStart > time()) {
            return (false, eventSale.saleStart, eventSale.saleEnd);
        } else if (eventSale.saleEnd > time()) {
            return (true, eventSale.saleStart, eventSale.saleEnd);
        } else {
            return (false, eventSale.saleStart, eventSale.saleEnd);
        }
    }
}

contract RobinosGovernanceToken is ERC721, Ownable, DeployingInBatches, PollFactory {
    string private baseURI;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_
    ) ERC721(name_, symbol_) Ownable() {
        baseURI = baseURI_;
    }

    function mint(
        address to,
        uint256 tokenId,
        string memory batchName
    ) public onlyOwner {
        _safeMint(to, tokenId);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        linkTokensToBatch(tokenIds, batchName);
    }

    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        string memory batchName
    ) public onlyOwner {
        require(allTokensInitialized(tokenIds, false), "RobinosGovernanceToken: some of the tokens are already minted");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _safeMint(to, tokenIds[i]);
        }
        linkTokensToBatch(tokenIds, batchName);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}

contract Period {
    string private _label;
    uint256 private _multiplier;

    constructor(string memory label_, uint256 multiplier_) {
        _label = label_;
        _multiplier = multiplier_;
    }

    function label() external view returns (string memory) {
        return _label;
    }

    function multiplier() external view returns (uint256) {
        return _multiplier;
    }
}

abstract contract HandlingTime is MatchingStrings {
    Period[5] private periods = [
        new Period("seconds", 1),
        new Period("minutes", 60),
        new Period("hours", 60),
        new Period("days", 24),
        new Period("weeks", 7)
    ];

    function periodLabels() private view returns (string[] memory) {
        uint256 length = periods.length;
        string[] memory periodLabelsArray = new string[](length);
        for (uint256 i = 0; i < length; i++) {
            periodLabelsArray[i] = periods[i].label();
        }
        return periodLabelsArray;
    }

    function getArrayIndexOf(string[] memory array, string memory str) private pure returns (uint256) {
        for (uint256 i = 0; i < array.length; i++) {
            if (matchStrings(str, array[i])) {
                return i;
            }
        }
        require(false, "HandlingTime: undefined period passed");
        return 0;
    }

    function toUnixTime(string memory period, uint256 amount) internal view returns (uint256) {
        uint256 periodIndex = getArrayIndexOf(periodLabels(), period);
        uint256 totalAmount = amount;
        for (uint256 i = periodIndex; i > 0; i--) {
            totalAmount *= periods[i].multiplier();
        }
        return totalAmount;
    }
}

abstract contract GeneratingRandomNumbers {
    // This constant directly defines the minimum amount of contestants in the stake pool
    // for the selectWinners function to be called
    uint256 constant minAddressesForRandomSequence = 5;
    uint256 constant maxSequenceCount = 70;
    uint256 constant minCountForRandomNumber = 5;
    uint256 private maxCountOfRandomNumbers = maxSequenceCount - minCountForRandomNumber;

    function simpleRandom(uint256 max) private view returns (uint256) {
        bytes32 hashedString = keccak256(abi.encodePacked(block.timestamp, block.difficulty));
        return uint256(hashedString) % max;
    }

    function getRandomSequence(address[] memory addresses, uint256 count) public view returns (uint256[] memory) {
        uint256 length = addresses.length;

        require(count <= maxSequenceCount, "Cannot generate a sequence with so many numbers");
        require(length >= minAddressesForRandomSequence, "More addresses required to generate random sequence");

        uint256[] memory randomSequence = new uint256[](count);
        uint256 base = addressToUint(addresses[simpleRandom(length)]);
        for (uint256 i = 1; i <= count; i++) {
            randomSequence[i - 1] = ((base % (10**i)) - (base % (10**(i - 1)))) / 10**(i - 1);
        }
        return randomSequence;
    }

    function _randomNumber(address[] memory addresses, uint256 count) private view returns (uint256) {
        require(count > minCountForRandomNumber, "Insufficient count for a random number");
        uint256[] memory sequence = getRandomSequence(addresses, count);
        uint256 rand = 1;
        for (uint256 i = 0; i < count / 2; i++) {
            rand += sequence[i]**sequence[count - (i + 1)];
        }
        return rand;
    }

    function randomNumber(
        address[] memory addresses,
        uint256 count,
        uint256 max
    ) internal view returns (uint256) {
        return _randomNumber(addresses, count) % max;
    }

    function randomNumber(address[] memory addresses, uint256 count) internal view returns (uint256) {
        return _randomNumber(addresses, count);
    }

    function randomNumbers(
        address[] memory addresses,
        uint256 count,
        uint256 max
    ) internal view returns (uint256[] memory) {
        require(count < maxCountOfRandomNumbers, "Cannot produce so many random numbers");
        uint256[] memory numbers = new uint256[](count);
        uint256 sequenceCount;
        for (uint256 i = 0; i < count; i++) {
            sequenceCount = maxSequenceCount - (i + 1);
            numbers[i] = randomNumber(addresses, sequenceCount, max);
        }
        return numbers;
    }

    function addressToUint(address _address) private pure returns (uint256) {
        return uint256(bytes32(abi.encodePacked(_address)));
    }
}

contract RewardingNFTs is ERC721Receiver, Ownable {
    ERC721 private nftInstance;

    mapping(address => uint256[]) private tokenIds;
    mapping(bytes32 => bool) private tokenSold;

    constructor(ERC721 nftInstance_) Ownable() {
        _updateERC721Instance(nftInstance_);
    }

    function _updateERC721Instance(ERC721 nftInstance_) internal {
        nftInstance = nftInstance_;
    }

    function getERC721Tokens(ERC721 nftInstance_) private view returns (uint256[] memory) {
        return tokenIds[address(nftInstance_)];
    }

    function hashERC721token(ERC721 nftInstance_, uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(address(nftInstance_), tokenId));
    }

    function markTokenSold(ERC721 nftInstance_, uint256 tokenId) private returns (bool) {
        bytes32 tokenHash = hashERC721token(nftInstance_, tokenId);
        require(!tokenSold[tokenHash], "RewardingNFTs: token already marked as sold");
        tokenSold[tokenHash] = true;
        return tokenSold[tokenHash];
    }

    function markTokenSold(uint256 tokenId) internal returns (bool) {
        return markTokenSold(nftInstance, tokenId);
    }

    function getAvailableERC721Tokens(ERC721 nftInstance_) private view returns (uint256[] memory) {
        uint256[] storage contractTokenIds = tokenIds[address(nftInstance_)];
        uint256 countAvailableTokens = 0;
        bytes32 tokenHash;
        for (uint256 i = 0; i < contractTokenIds.length; i++) {
            tokenHash = hashERC721token(nftInstance_, contractTokenIds[i]);
            if (!tokenSold[tokenHash]) countAvailableTokens++;
        }

        uint256[] memory availableTokens = new uint256[](countAvailableTokens);
        uint256 availableTokenIndex = 0;
        for (uint256 i = 0; i < contractTokenIds.length; i++) {
            tokenHash = hashERC721token(nftInstance_, contractTokenIds[i]);
            if (!tokenSold[tokenHash]) {
                availableTokens[availableTokenIndex] = contractTokenIds[i];
                availableTokenIndex++;
            }
        }
        return availableTokens;
    }

    // Retreives only the available tokens in an array
    function getAvailableTokens() public view returns (uint256[] memory) {
        return getAvailableERC721Tokens(nftInstance);
    }

    // Retreives the number of available tokens
    function numOfAvailableTokens() public view returns (uint256) {
        uint256[] memory tokens = getAvailableTokens();
        return tokens.length;
    }

    function transferToken(uint256 tokenId, address to) internal {
        nftInstance.transferFrom(address(this), to, tokenId);
    }

    // Function will revert in case the wrong NFT contract is sending tokens to this address
    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        require(_msgSender() == address(nftInstance), "RewardingNFTs: incorrect ERC721 contract call");
        tokenIds[address(nftInstance)].push(tokenId);
        return receiverSignature;
    }
}

/***********************************************************************
 ***********************************************************************
 ***********      ROBINOS GOVERNANCE TOKEN LUCKY DRAW        ***********
 ***********************************************************************
 **********************************************************************/

contract RobinosGovernanceTokenLuckyDraw is SaleFactory, RewardingNFTs, HandlingTime, GeneratingRandomNumbers {
    StandardToken private standardToken;

    struct UserStake {
        uint256 totalStaked;
        uint256 stakedAt;
        uint256 unstakedAt;
    }
    mapping(bytes32 => uint256) private totalStakedPerEvent;
    mapping(bytes32 => mapping(address => UserStake)) private userStakedPerEvent;
    mapping(bytes32 => address[]) private usersPerEventArrayMapping;
    uint256 private stakeDurationTime;

    // For each event, we record which tokens each user won
    mapping(bytes32 => mapping(address => uint256[])) private rewardWinners;

    /**
     * @param nftInstance_ address to the ERC721 token which will be given as a reward
     * @param standardToken_ standard token used for staking
     * @param period_ the chosen period to multiply with the stake duration. One of the options given in the HandlingTime contract
     * @param stakeDuration_ number to multiply the period by, gives the total stake duration time
     */
    constructor(
        ERC721 nftInstance_,
        StandardToken standardToken_,
        string memory period_,
        uint256 stakeDuration_
    ) RewardingNFTs(nftInstance_) {
        standardToken = standardToken_;
        stakeDurationTime = toUnixTime(period_, stakeDuration_);
    }

    modifier notZeroAddress(address user) {
        require(user != address(0), "RobinosGovernanceTokenLuckyDraw: zero address not allowed");
        _;
    }

    modifier userStakedLongEnough(string memory eventCode, address user) {
        (uint256 totalUserStaked, uint256 stakedAt, ) = getUserStaked(eventCode, user);
        require(totalUserStaked > 0, "RobinosGovernanceTokenLuckyDraw: user has no stake for this event");
        require(
            stakedAt > 0 && stakedAt + stakeDurationTime < time(),
            "RobinosGovernanceTokenLuckyDraw: too early to unstake, please try again later"
        );
        _;
    }

    modifier userNotUnstaked(string memory eventCode, address user) {
        (uint256 totalUserStaked, uint256 stakedAt, uint256 unstakedAt) = getUserStaked(eventCode, user);
        require(unstakedAt == 0, "RobinosGovernanceTokenLuckyDraw: user already unstaked in this event");
        _;
    }

    /**
     * Powered by GeneratingRandomNumbers contract, this function will generate a sequence of random numbers.
     * It will automatically send all the addresses that staked during this event as seeds to create a random number
     * @param eventCode code of the event for which you wish to create random numbers for
     * @param count amount of random numbers returned in the array
     */
    function getRandomNumbers(string memory eventCode, uint256 count) private view returns (uint256[] memory) {
        address[] memory addresses = getUsersNotUnstaked(eventCode);
        uint256 totalStaked = getTotalStaked(eventCode);
        return randomNumbers(addresses, count, totalStaked);
    }

    function pickWinners(string memory eventCode, uint256 count) private view returns (address[] memory) {
        address[] memory contestants = getUsersNotUnstaked(eventCode);
        uint256[] memory amountStaked = getStakesPerUser(eventCode);
        uint256 numOfContestants = contestants.length;
        uint256 accumulateStakedAmount;
        address[] memory chosenWinners = new address[](count);
        uint256[] memory randomNumbers = getRandomNumbers(eventCode, count);

        for (uint256 j = 0; j < count; j++) {
            accumulateStakedAmount = 0;
            for (uint256 i = 0; i < numOfContestants; i++) {
                accumulateStakedAmount += amountStaked[i];
                if (randomNumbers[j] < accumulateStakedAmount) {
                    chosenWinners[j] = contestants[i];
                    break;
                }
            }
        }

        return chosenWinners;
    }

    function getTokensWon(string memory eventCode, address user)
        private
        view
        notZeroAddress(user)
        returns (uint256[] storage)
    {
        isSaleOn(eventCode);
        return rewardWinners[hashStr(eventCode)][user];
    }

    /**
     * Allows the owner to select the winners of the current event. The function will select
     * winners for each token. One user can win multiple tokens, but no token go undistributed.
     * For any user to be drafted for the reward, they mustn't have unstaked their standard
     * token during this event yet
     * @param eventCode code of the event for which you wish select the winners for
     */
    function selectWinners(string memory eventCode) public onlyOwner {
        uint256 numOfTokens = numOfAvailableTokens();
        address[] memory winners = pickWinners(eventCode, numOfTokens);
        uint256[] memory tokens = getAvailableTokens();
        uint256[] storage userTokensWon;
        for (uint256 i = 0; i < numOfTokens; i++) {
            userTokensWon = getTokensWon(eventCode, winners[i]);
            userTokensWon.push(tokens[i]);
            markTokenSold(tokens[i]);
        }
    }

    /**
     * Total amount of staked standardTokens during particular event
     */
    function getTotalStaked(string memory eventCode) public view returns (uint256) {
        // Function used to revert in case the event has not been initialized yet
        isSaleOn(eventCode);
        bytes32 eventHash = hashStr(eventCode);
        return totalStakedPerEvent[eventHash];
    }

    function getUserStaked(string memory eventCode, address user)
        private
        view
        notZeroAddress(user)
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        isSaleOn(eventCode);
        bytes32 eventHash = hashStr(eventCode);
        UserStake storage userStake = userStakedPerEvent[eventHash][user];
        return (userStake.totalStaked, userStake.stakedAt, userStake.unstakedAt);
    }

    /**
     * Get user stake amount for particular event
     */
    function getUserStakeAmount(string memory eventCode, address user) public view returns (uint256) {
        (uint256 totalUserStaked, , ) = getUserStaked(eventCode, user);
        return totalUserStaked;
    }

    /**
     * Retrevies an array of addresses of all users that staked during this event
     */
    function getUsersStaked(string memory eventCode) public view returns (address[] memory) {
        isSaleOn(eventCode);
        bytes32 eventHash = hashStr(eventCode);
        return usersPerEventArrayMapping[eventHash];
    }

    /**
     * Retrevies an array of addresses of all users that staked during this event and have not unstaked yet
     */
    function getUsersNotUnstaked(string memory eventCode) public view returns (address[] memory) {
        address[] memory usersStaked = getUsersStaked(eventCode);
        uint256 usersNotUnstakedCount = 0;
        uint256 unstakedAt;
        for (uint256 i = 0; i < usersStaked.length; i++) {
            (, , unstakedAt) = getUserStaked(eventCode, usersStaked[i]);
            if (unstakedAt == 0) usersNotUnstakedCount++;
        }
        address[] memory usersNotUnstaked = new address[](usersNotUnstakedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < usersStaked.length; i++) {
            (, , unstakedAt) = getUserStaked(eventCode, usersStaked[i]);
            if (unstakedAt == 0) {
                usersNotUnstaked[index] = usersStaked[i];
                index++;
            }
        }
        return usersNotUnstaked;
    }

    function getStakesPerUser(string memory eventCode) public view returns (uint256[] memory) {
        address[] memory usersStaked = getUsersStaked(eventCode);
        uint256[] memory stakePerUser = new uint256[](usersStaked.length);
        for (uint256 i = 0; i < usersStaked.length; i++) {
            stakePerUser[i] = getUserStakeAmount(eventCode, usersStaked[i]);
        }

        return stakePerUser;
    }

    /**
     * Retrevies an array of addresses of all users that staked during this event;
     * How much each user staked;
     * Total amount staked during this event;
     * Total number of tokens on this contract
     */
    function getEventStakeData(string memory eventCode)
        public
        view
        returns (
            address[] memory,
            uint256[] memory,
            uint256,
            uint256
        )
    {
        address[] memory usersNotUnstaked = getUsersNotUnstaked(eventCode);
        uint256[] memory stakePerUser = getStakesPerUser(eventCode);
        uint256 totalStaked = getTotalStaked(eventCode);
        uint256 numOfTokens = numOfAvailableTokens();

        return (usersNotUnstaked, stakePerUser, totalStaked, numOfTokens);
    }

    function claimRewards(string memory eventCode) private {
        uint256[] memory tokensWon = getTokensWon(eventCode, _msgSender());
        for (uint256 i = 0; i < tokensWon.length; i++) {
            transferToken(tokensWon[i], _msgSender());
        }
    }

    function addStakedAmount(
        string memory eventCode,
        address user,
        uint256 amount
    ) private notZeroAddress(user) {
        isSaleOn(eventCode);
        bytes32 eventHash = hashStr(eventCode);

        totalStakedPerEvent[eventHash] += amount;

        UserStake storage userStake = userStakedPerEvent[eventHash][user];
        userStake.totalStaked += amount;
        if (userStake.stakedAt == 0) {
            usersPerEventArrayMapping[eventHash].push(user);
        }
        userStake.stakedAt = time();
    }

    function removeStakedAmount(
        string memory eventCode,
        address user,
        uint256 amount
    ) private notZeroAddress(user) {
        isSaleOn(eventCode);
        bytes32 eventHash = hashStr(eventCode);
        UserStake storage userStake = userStakedPerEvent[eventHash][user];

        require(userStake.totalStaked >= amount, "RobinosGovernanceTokenLuckyDraw: insufficient amount for unstaking");
        unchecked {
            totalStakedPerEvent[eventHash] -= amount;
            userStake.totalStaked -= amount;
        }
        userStake.unstakedAt = time();
    }

    /**
     * Staking function. This endpoint has a number of requirements listed below:
     * 1) User must approve enough standard tokens for this transaction;
     * 2) User must call this function while a sale is active;
     * 3) User cannot stake in this event if they already unstaked at least once during this event;
     * 4) User must stake at least one token
     */
    function stake(string memory eventCode, uint256 amount)
        public
        duringSale(eventCode)
        userNotUnstaked(eventCode, _msgSender())
    {
        require(amount > 0, "RobinosGovernanceTokenLuckyDraw: stake amount of 0 not allowed");

        addStakedAmount(eventCode, _msgSender(), amount);
        standardToken.transferFrom(_msgSender(), address(this), amount);
    }

    /**
     * Unstaking function. This endpoint has a number of requirements listed below:
     * 1) User cannot unstake more than once during a single event;
     * 2) User must wait for the staking duration time to pass after their LAST STAKE to be able to unstake;
     * 3) User must unstake while the sale is active
     */
    function unstake(string memory eventCode)
        public
        userNotUnstaked(eventCode, _msgSender())
        userStakedLongEnough(eventCode, _msgSender())
    {
        (uint256 totalUserStaked, , ) = getUserStaked(eventCode, _msgSender());
        removeStakedAmount(eventCode, _msgSender(), totalUserStaked);
        claimRewards(eventCode);
        standardToken.transfer(_msgSender(), totalUserStaked);
    }
}

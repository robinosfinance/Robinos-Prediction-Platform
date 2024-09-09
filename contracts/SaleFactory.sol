// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "./openzeppelin/Ownable.sol";
import {StringUtils} from "./libraries/StringUtils.sol";
import {ReadingTime} from "./utils/ReadingTime.sol";
import {Sale} from "./enums/SaleFactory.sol";

abstract contract SaleFactory is Ownable, ReadingTime {
    using StringUtils for string;

    mapping(bytes32 => Sale) private _eventSale;

    // Modifier allowing a call only if event by eventCode is currently active
    modifier duringSale(string memory eventCode) {
        Sale storage eventSale = getEventSale(eventCode);
        require(saleIsActive(eventSale), "sale not active");

        _;
    }

    modifier saleHasEnded(string memory eventCode) {
        Sale storage eventSale = _eventSale[eventCode.hashStr()];
        require(time() >= eventSale.saleEnd, "sale has not ended yet");

        _;
    }

    function saleIsActive(Sale memory sale) private view returns (bool) {
        return (time() >= sale.saleStart) && (time() < sale.saleEnd);
    }

    /**
     * @dev Function returns Sale struct with saleEnd and saleStart. Function reverts if event is not initialized
     * @param eventCode string code of event
     */
    function getEventSale(string memory eventCode) private view returns (Sale storage) {
        Sale storage eventSale = _eventSale[eventCode.hashStr()];
        require(eventSale.saleStart > 0 || eventSale.saleEnd > 0, "sale not initialized");
        return eventSale;
    }

    function _setSaleStartEnd(string memory eventCode, uint256 start, uint256 end) internal returns (bool) {
        bytes32 saleHash = eventCode.hashStr();
        Sale storage eventSale = _eventSale[saleHash];

        if (start != 0) {
            require(start > time(), "given past sale start time");
        } else {
            start = time();
        }
        require(end > start, "sale end time needs to be greater than start time");

        eventSale.saleStart = start;
        eventSale.saleEnd = end;

        return true;
    }

    function updateSale(string memory eventCode, uint256 start, uint256 end) external onlyOwner {
        require(_eventSale[eventCode.hashStr()].saleStart > 0, "sale not initialized");

        _setSaleStartEnd(eventCode, start, end);
    }

    // Function can be called by the owner during a sale to end it prematurely
    function endSaleNow(string memory eventCode) external onlyOwner duringSale(eventCode) {
        Sale storage eventSale = getEventSale(eventCode);

        eventSale.saleEnd = time();
    }

    /**
     * @dev Public function which provides info if there is currently any active sale and when the sale status will update.
     * Value saleActive represents if sale is active at the current moment.
     * If sale has been initialized, saleStart and saleEnd will return UNIX timestampts
     * If sale has not been initialized, function will revert.
     * @param eventCode string code of event
     */
    function isSaleOn(
        string memory eventCode
    ) public view returns (bool saleActive, uint256 saleStart, uint256 saleEnd) {
        Sale storage eventSale = getEventSale(eventCode);

        return (saleIsActive(eventSale), eventSale.saleStart, eventSale.saleEnd);
    }
}

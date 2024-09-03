// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "./openzeppelin/Ownable.sol";
import {StringUtils} from "./libraries/StringUtils.sol";
import {ReadingTime} from "./utils/ReadingTime.sol";

abstract contract SaleFactory is Ownable, ReadingTime {
    using StringUtils for string;

    // Each sale has an entry in the eventCode hash table with start and end time.
    // If both saleStart and saleEnd are 0, sale is not initialized
    event SaleEnded(string indexed eventCode, uint256 endTime); //! End Time
    event SaleStartEndTime(string indexed eventCode, uint256 startTime, uint256 endTime);
    struct Sale {
        uint256 saleStart;
        uint256 saleEnd;
    }
    mapping(bytes32 => Sale) private _eventSale;

    // Modifier allowing a call only if event by eventCode is currently active
    modifier duringSale(string memory eventCode) {
        Sale storage eventSale = getEventSale(eventCode);
        require(saleIsActive(eventSale), "SaleFactory: function can only be called during sale");
        _;
    }

    modifier saleHasEnded(string memory eventCode) {
        Sale storage eventSale = _eventSale[eventCode.hashStr()];
        require(time() >= eventSale.saleEnd, "SaleFactory: sale has not ended yet");

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
        require(eventSale.saleStart > 0 || eventSale.saleEnd > 0, "SaleFactory: sale not initialized");
        return eventSale;
    }

    function _setSaleStartEnd(string memory eventCode, uint256 start, uint256 end) internal returns (bool) {
        bytes32 saleHash = eventCode.hashStr();
        Sale storage eventSale = _eventSale[saleHash];

        if (start != 0) {
            require(start > time(), "SaleFactory: given past sale start time");
        } else {
            start = time();
        }
        require(end > start, "SaleFactory: sale end time needs to be greater than start time");

        eventSale.saleStart = start;
        eventSale.saleEnd = end;

        return true;
    }

    // Function can be called by the owner during a sale to end it prematurely
    function endSaleNow(string memory eventCode) public onlyOwner duringSale(eventCode) returns (bool) {
        Sale storage eventSale = getEventSale(eventCode);

        eventSale.saleEnd = time();
        emit SaleEnded(eventCode, eventSale.saleEnd);
        return true;
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

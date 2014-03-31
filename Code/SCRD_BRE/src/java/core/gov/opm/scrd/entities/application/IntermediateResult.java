/*
    Copyright 2014 OPM.gov

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

package gov.opm.scrd.entities.application;

import gov.opm.scrd.entities.common.IdentifiableEntity;

import java.math.BigDecimal;
import java.util.Date;

/**
 * <p>
 * This is the class representing the single item of the intermediate result of the calculation.
 * <strong>Thread Safety: </strong> This class is mutable and not thread safe.
 * </p>
 *
 * @author yedtoss
 * @version 1.0
 */
public class IntermediateResult extends IdentifiableEntity {

     /**
     * Represents the intermediate interest/deduction amount.
     */
    private BigDecimal intermediateAmount;

    /**
     * Represents the intermediate interest/deduction rate.
     */
    private Double intermediateRate;

    /**
     * Represents the intermediate begin date.
     */
    private Date intermediateBeginDate;

    /**
     * Represents the intermediate end date.
     */
    private Date intermediateEndDate;

    /**
     * Represents balance with interest.
     * 
     * It will be set by InterestCalculationRuleService.
     */
    private BigDecimal balanceWithInterest;


    /**
     * Getter for the intermediateAmount.
     *
     * @return the intermediateAmount
     */
    public BigDecimal getIntermediateAmount() {
        return intermediateAmount;
    }

    /**
     * Setter for the intermediateAmount.
     *
     * @param intermediateAmount the intermediateAmount to set
     */
    public void setIntermediateAmount(BigDecimal intermediateAmount) {
        this.intermediateAmount = intermediateAmount;
    }

     /**
     * Getter for the intermediateRate.
     *
     * @return the intermediateRate
     */
    public Double getIntermediateRate() {
        return intermediateRate;
    }

    /**
     * Setter for the intermediateRate.
     *
     * @param intermediateRate the intermediateRate to set
     */
    public void setIntermediateRate(Double intermediateRate) {
        this.intermediateRate = intermediateRate;
    }

    /**
     * Getter for the intermediateBeginDate.
     *
     * @return the intermediateBeginDate
     */
    public Date getIntermediateBeginDate() {
        return intermediateBeginDate;
    }

    /**
     * Setter for the intermediateBeginDate.
     *
     * @param intermediateBeginDate the intermediateBeginDate to set
     */
    public void setIntermediateBeginDate(Date intermediateBeginDate) {
        this.intermediateBeginDate = intermediateBeginDate;
    }

     /**
     * Getter for the intermediateEndDate.
     *
     * @return the intermediateEndDate
     */
    public Date getIntermediateEndDate() {
        return intermediateEndDate;
    }

    /**
     * Setter for the intermediateEndDate.
     *
     * @param intermediateEndDate the intermediateEndDate to set
     */
    public void setIntermediateEndDate(Date intermediateEndDate) {
        this.intermediateEndDate = intermediateEndDate;
    }

    /**
     * Gets balance with interest.
     * @return balance with interest.
     */
    public BigDecimal getBalanceWithInterest() {
        return balanceWithInterest;
    }

    /**
     * Sets balance with interest.
     * @param balanceWithInterest balance with interest.
     */
    public void setBalanceWithInterest(BigDecimal balanceWithInterest) {
        this.balanceWithInterest = balanceWithInterest;
    }

}
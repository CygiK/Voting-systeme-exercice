import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("VotingPlus", async () => {
    async function deployVotingPlusFixture() {
            const [owner, voter1, voter2, voter3, voter4] = await ethers.getSigners();
            const VotingPlus = await ethers.getContractFactory("Voting");
            const votingPlus = await VotingPlus.deploy();
            return { votingPlus, owner, voter1, voter2, voter3, voter4 };
        }

    async function deployVotingPlusFixtureWithVoters() {
            const { votingPlus, owner, voter1, voter2, voter3, voter4 } = await deployVotingPlusFixture();
            await votingPlus.connect(owner).addVoter(owner.address);
            await votingPlus.connect(owner).addVoter(voter1.address);
            await votingPlus.connect(owner).addVoter(voter2.address);
            await votingPlus.connect(owner).addVoter(voter3.address);
            return { votingPlus, owner, voter1, voter2, voter3, voter4 };
    }

    async function deployVotingPlusFixtureWithVotersAndProposals() {
            const { votingPlus, owner, voter1, voter2, voter3, voter4 } = await deployVotingPlusFixtureWithVoters();
            await votingPlus.nextWorkflowStatus(); // Move to ProposalsRegistrationStarted
            await votingPlus.connect(voter1).addProposal("Proposal 1");
            await votingPlus.connect(voter2).addProposal("Proposal 2");
            return { votingPlus, owner, voter1, voter2, voter3, voter4 };
    }
        
        describe("Deployment", () => {
            it("should deploy the VotingPlus contract", async () => {
                const { votingPlus, owner } = await loadFixture(deployVotingPlusFixture);
                expect(votingPlus).to.be.ok;
                expect(await votingPlus.owner()).to.equal(owner.address);
            });
        });

        describe("Voters Management :", () => {
            it("addVoter : should be able to Register voters", async () => {
                const { votingPlus,owner, voter1, voter2, voter3, voter4 } = await loadFixture(deployVotingPlusFixture);
                expect(await votingPlus.getWorkflowStatus()).to.equal(0); // WorkflowStatus.RegisteringVoters

                await expect(votingPlus.connect(owner).addVoter(owner.address)).to.emit(votingPlus, "VoterRegistered").withArgs(owner.address);
                const ownerInfo = await votingPlus.connect(owner).getVoter(owner.address);
                expect(ownerInfo.isRegistered).to.be.true;
                expect(ownerInfo.hasVoted).to.be.false;
                expect(ownerInfo.votedProposalId).to.equal(0);
                

                await expect(votingPlus.connect(voter1).addVoter(voter2.address)).to.be.revertedWithCustomError(
                    votingPlus, "OwnableUnauthorizedAccount").withArgs(voter1.address);
                await expect(votingPlus.connect(owner).addVoter(voter1.address)).to.emit(votingPlus, "VoterRegistered").withArgs(voter1.address);

                const voter1info = await votingPlus.connect(owner).getVoter(voter1.address);
                expect(voter1info.isRegistered).to.be.true;
                expect(voter1info.hasVoted).to.be.false;
                await expect(votingPlus.addVoter(voter1.address)).to.be.revertedWith("Already registered");

                await expect(votingPlus.connect(voter2).addVoter(voter3.address)).to.be.revertedWithCustomError(
                    votingPlus, "OwnableUnauthorizedAccount").withArgs(voter2.address);
                await expect(votingPlus.connect(owner).addVoter(voter2.address)).to.emit(votingPlus, "VoterRegistered").withArgs(voter2.address);
                await expect(votingPlus.connect(voter4).getVoter(voter3.address)).to.be.revertedWith("You're not a voter");
                const voter2Info = await votingPlus.connect(owner).getVoter(voter2.address);
                expect(voter2Info.isRegistered).to.be.true;
                expect(voter2Info.hasVoted).to.be.false;

                await expect(votingPlus.connect(owner).addVoter(voter3.address)).to.emit(votingPlus, "VoterRegistered").withArgs(voter3.address);
                const voter3Info = await votingPlus.connect(owner).getVoter(voter3.address);
                expect(voter3Info.isRegistered).to.be.true;
                expect(voter3Info.hasVoted).to.be.false;
            });

           it("deleteVoter : should be able to delete voters", async () => {
                const { votingPlus, voter3, voter4 } = await loadFixture(deployVotingPlusFixtureWithVoters);
                await expect(votingPlus.getVoter(voter3.address)).to.be.ok;
                await expect(votingPlus.connect(voter4).getVoter(voter3.address)).to.be.revertedWith("You're not a voter");
                await expect(votingPlus.connect(voter4).deleteVoter(voter3.address)).to.be.revertedWithCustomError(votingPlus, "OwnableUnauthorizedAccount").withArgs(voter4.address);
                await expect(votingPlus.deleteVoter(voter3.address)).to.emit(votingPlus, "VoterRegistered").withArgs(voter3.address);
                await votingPlus.nextWorkflowStatus();
                expect(await votingPlus.getWorkflowStatus()).to.equal(1); // WorkflowStatus.ProposalsRegistrationStarted
                await expect(votingPlus.deleteVoter(voter3.address)).to.be.revertedWith("Voters registration is not open yet");
                const voter3Info = await votingPlus.getVoter(voter3.address);
                expect(voter3Info.isRegistered).to.be.false;
            });
        });

        describe("Workflow Status", () => {
            it("you should be able to start to add proposals if the workflow status is ProposalsRegistrationStarted", async () => {
              const { votingPlus, voter1 } = await loadFixture(deployVotingPlusFixtureWithVoters);
              await expect(votingPlus.connect(voter1).addProposal("")).to.be.revertedWith("Proposals are not allowed yet");
            });

            it("should be able to change workflow status", async () => {
                const { votingPlus, voter1 } = await loadFixture(deployVotingPlusFixture);
                expect(await votingPlus.getWorkflowStatus()).to.equal(0); // WorkflowStatus.RegisteringVoters

                await votingPlus.nextWorkflowStatus();
                expect(await votingPlus.getWorkflowStatus()).to.equal(1); // WorkflowStatus.ProposalsRegistrationStarted

                await votingPlus.nextWorkflowStatus();
                expect(await votingPlus.getWorkflowStatus()).to.equal(2); // WorkflowStatus.VotingSessionStarted

                await expect(votingPlus.connect(voter1).setWorkflowStatus(3)).to.be.revertedWithCustomError(votingPlus, "OwnableUnauthorizedAccount").withArgs(voter1.address);
                await expect(votingPlus.setWorkflowStatus(4)).to.be.revertedWith("bad workflowstatus");

                await votingPlus.nextWorkflowStatus();
                expect(await votingPlus.getWorkflowStatus()).to.equal(3); // WorkflowStatus.VotesTallied

                await votingPlus.setWorkflowStatus(4);
                expect(await votingPlus.getWorkflowStatus()).to.be.equal(4);

                await expect(votingPlus.nextWorkflowStatus()).to.be.revertedWith("il faut lancer tallyvotes");

                await expect(votingPlus.setWorkflowStatus(5)).to.be.revertedWith("il faut lancer tally votes");
            });
    });


    describe("Proposals Management :", () => {
        it("should be able to register proposals", async () => {
            const { votingPlus, voter1, voter2, voter4 } = await loadFixture(deployVotingPlusFixtureWithVoters);
            const proposal1 = "Proposal 1";
            const proposal2 = "Proposal 2";

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(1); // WorkflowStatus.ProposalsRegistrationStarted
            await expect(votingPlus.addVoter(voter4.address)).to.be.revertedWith("Voters registration is not open yet");

            await expect(votingPlus.connect(voter1).addProposal(proposal1)).to.emit(votingPlus, "ProposalRegistered").withArgs(0);
            await expect(votingPlus.connect(voter4).addProposal(proposal1)).to.be.revertedWith("You're not a voter");
            await expect(votingPlus.connect(voter4).getOneProposal(0)).to.be.revertedWith("You're not a voter");
            const proposal1Info = await votingPlus.getOneProposal(0);
            expect(proposal1Info.description).to.equal(proposal1);
            expect(proposal1Info.voteCount).to.equal(0);

            await expect(votingPlus.connect(voter2).addProposal("")).to.be.revertedWith("Vous ne pouvez pas ne rien proposer");

            await votingPlus.connect(voter2).addProposal(proposal2);
            const proposal2Info = await votingPlus.getOneProposal(1);
            expect(proposal2Info.description).to.equal(proposal2);
        });
    });

    describe("Voting Management :", () => {
        it("should be able to vote", async () => {
            const { votingPlus, voter1, voter2, voter3 } = await loadFixture(deployVotingPlusFixtureWithVotersAndProposals);

            expect(await votingPlus.getWorkflowStatus()).to.equal(1);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(2);
            await expect(votingPlus.connect(voter1).setVote(0)).to.be.revertedWith('Voting session havent started yet');
            await votingPlus.nextWorkflowStatus();
            await expect(votingPlus.connect(voter1).setVote(0)).to.emit(votingPlus, "Voted").withArgs(voter1.address, 0);
            await expect(votingPlus.connect(voter1).setVote(1)).to.be.revertedWith("You have already voted");
            await votingPlus.connect(voter2).setVote(1);
            await expect(votingPlus.connect(voter3).setVote(2)).to.be.revertedWith("Proposal not found");

            const voter1Info = await votingPlus.getVoter(voter1.address);
            expect(voter1Info.isRegistered).to.be.true;
            expect(voter1Info.hasVoted).to.be.true;
            expect(voter1Info.votedProposalId).to.equal(0);

            const voter2Info = await votingPlus.getVoter(voter2.address);
            expect(voter2Info.isRegistered).to.be.true;
            expect(voter2Info.hasVoted).to.be.true;
            expect(voter2Info.votedProposalId).to.equal(1);
        });
    });

    describe("Tallying Votes :", () => {
        it("should be able to tally votes and get 1 winner", async () => {
            const { votingPlus, voter1, voter2, voter3 } = await loadFixture(deployVotingPlusFixtureWithVotersAndProposals);

            await expect(votingPlus.connect(voter1).nextWorkflowStatus()).to.be.revertedWithCustomError(
                votingPlus, "OwnableUnauthorizedAccount").withArgs(voter1.address);
            expect(await votingPlus.getWorkflowStatus()).to.equal(1);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(2);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(3);
            await votingPlus.connect(voter1).setVote(0);
            await votingPlus.connect(voter2).setVote(1);
            await votingPlus.connect(voter3).setVote(0);

            await expect(votingPlus.tallyVotesDraw()).to.be.revertedWith("Current status is not voting session ended");
            await expect(votingPlus.connect(voter1).tallyVotesDraw()).to.be.revertedWithCustomError(
                votingPlus, "OwnableUnauthorizedAccount").withArgs(voter1.address);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(4);
            const winningArray = await votingPlus.tallyVotesDraw.staticCall();
            expect(winningArray).to.have.lengthOf(1);
            expect(winningArray[0]).to.equal(0);
        });

        it("should be able to tally and get draw winners", async () => {
            const { votingPlus, voter1, voter2 } = await loadFixture(deployVotingPlusFixtureWithVotersAndProposals);

            await expect(votingPlus.connect(voter1).nextWorkflowStatus()).to.be.revertedWithCustomError(
                votingPlus, "OwnableUnauthorizedAccount").withArgs(voter1.address);
            expect(await votingPlus.getWorkflowStatus()).to.equal(1);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(2);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(3);
            await votingPlus.connect(voter1).setVote(1);
            await votingPlus.connect(voter2).setVote(0);

            await expect(votingPlus.tallyVotesDraw()).to.be.revertedWith("Current status is not voting session ended");
            await expect(votingPlus.connect(voter1).tallyVotesDraw()).to.be.revertedWithCustomError(
                votingPlus, "OwnableUnauthorizedAccount").withArgs(voter1.address);

            await votingPlus.nextWorkflowStatus();
            expect(await votingPlus.getWorkflowStatus()).to.equal(4);
            const winningArray = await votingPlus.tallyVotesDraw.staticCall();
            expect(winningArray).to.have.lengthOf(2);
            expect(winningArray[0]).to.equal(0);
            expect(winningArray[1]).to.equal(1);
        });
    });
});
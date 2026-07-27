import { AlertApplicationService } from "@/lib/alerts/AlertApplicationService";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { userRepository } from "@/lib/users/UserRepository";

export const alertApplicationService = new AlertApplicationService(
  userRepository,
  regulatoryDataService,
);
